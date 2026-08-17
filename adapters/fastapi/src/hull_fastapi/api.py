from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from fastapi import Depends, FastAPI, File, Request, Response, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.responses import Response as RawResponse
from pydantic import BaseModel
from starlette.exceptions import HTTPException as StarletteHTTPException

from hull_fastapi.accounts import (
    RESET_TTL,
    SESSION_TTL,
    SUPPORT_TTL,
    AccountError,
    change_password,
    close_account,
    consume_handoff,
    create_org,
    list_orgs,
    list_users,
    load_session,
    me_body,
    request_password_reset,
    require_admin,
    reset_password,
    set_avatar_key,
    signin,
    signout,
    signup,
    support_start,
    support_stop,
    switch_org,
    update_profile,
)
from hull_fastapi.config import Settings
from hull_fastapi.db import connection
from hull_fastapi.mail import send_mail
from hull_fastapi.observe import record_event
from hull_fastapi.storage import StorageError, delete_avatar, get_avatar, put_avatar, s3_enabled

PROBLEM_JSON = "application/problem+json"

# The avatar cap lives in storage.put_avatar; this is the envelope allowance so a
# multipart body can be refused on Content-Length before Starlette buffers it.
MAX_AVATAR_BYTES = 5 * 1024 * 1024
MAX_UPLOAD_BYTES = MAX_AVATAR_BYTES + 64 * 1024

log = logging.getLogger("hull.api")


class SignupBody(BaseModel):
    username: str
    email: str
    password: str


class SigninBody(BaseModel):
    email: str
    password: str


class OrgBody(BaseModel):
    name: str


class SwitchBody(BaseModel):
    id: UUID


class ProfileBody(BaseModel):
    username: str | None = None
    name: str | None = None


class PasswordBody(BaseModel):
    current: str
    password: str


class CloseBody(BaseModel):
    password: str


class SupportBody(BaseModel):
    org_id: UUID


class HandoffBody(BaseModel):
    token: str


class ForgotBody(BaseModel):
    email: str


class ResetBody(BaseModel):
    token: str
    password: str


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()
    # contracts/openapi.yaml is the contract. Do not publish a second, generated
    # spec (or its docs UI) from the adapter.
    app = FastAPI(
        title="hull-api",
        version="0.1.0",
        root_path=(settings.root_path or "").rstrip("/"),
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
    )
    app.state.settings = settings

    origins = [o.strip() for o in (settings.cors_origins or "").split(",") if o.strip()]
    if not origins:
        # Only the two authenticated surfaces. The apex and www have no auth and
        # never call the API with credentials, and listing them in a credentialed
        # CORS policy only widened what could reach it with a cookie attached.
        origins = [
            f"https://app.{settings.host}",
            f"https://admin.{settings.host}",
        ]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Accept"],
    )

    def problem(status: int, title: str, detail: str, reason_code: str) -> JSONResponse:
        return JSONResponse(
            status_code=status,
            content={
                "type": "about:blank",
                "title": title,
                "status": status,
                "detail": detail,
                "reason_code": reason_code,
            },
            media_type=PROBLEM_JSON,
        )

    @app.exception_handler(RequestValidationError)
    async def validation_handler(_request: Request, exc: RequestValidationError) -> JSONResponse:
        return problem(422, "Validation error", str(exc.errors()), "request_validation_error")

    @app.exception_handler(StarletteHTTPException)
    async def http_handler(_request: Request, exc: StarletteHTTPException) -> JSONResponse:
        detail = exc.detail
        if isinstance(detail, dict) and "reason_code" in detail:
            return JSONResponse(
                status_code=exc.status_code, content=detail, media_type=PROBLEM_JSON
            )
        if exc.status_code == 404:
            return problem(404, "Not found", "Not found", "not_found")
        return problem(exc.status_code, "Error", str(detail), "http_error")

    @app.exception_handler(Exception)
    async def unhandled_handler(request: Request, exc: Exception) -> JSONResponse:
        # Every error leaves as problem+json. A bare 500 with a text/plain body
        # breaks the shared client, which parses every non-204 response as JSON.
        log.exception("unhandled error on %s %s", request.method, request.url.path)
        return problem(500, "Server error", "unexpected server error", "server_error")

    @app.middleware("http")
    async def retire_duplicate_session_cookie(request: Request, call_next):
        # A user stuck in the redirect loop never reaches an endpoint that sets a
        # cookie — they are bounced on GET /v1/me. Two entries of the same name in
        # the Cookie header is proof a legacy apex cookie is in play, so retire it
        # here and the very next request resolves to the right session.
        response = await call_next(request)
        raw = request.headers.get("cookie") or ""
        seen = sum(
            1 for c in raw.split(";") if c.strip().split("=", 1)[0].strip() == settings.cookie_name
        )
        if seen > 1 and _under_apex(request):
            response.delete_cookie(
                settings.cookie_name, path="/", domain=f".{settings.host.lower()}"
            )
        return response

    @app.middleware("http")
    async def cap_upload_body(request: Request, call_next):
        # Refuse an oversized upload before the multipart parser buffers it.
        # The cap inside put_avatar runs after the whole body is already in memory.
        if request.method == "POST" and request.url.path.rstrip("/").endswith("/v1/me/avatar"):
            declared = request.headers.get("content-length")
            if declared is None or not declared.isdigit():
                return problem(
                    411, "Length required", "content-length is required", "request_validation_error"
                )
            if int(declared) > MAX_UPLOAD_BYTES:
                return problem(413, "Too large", "photo is too large", "request_validation_error")
        return await call_next(request)

    def _account_http(exc: AccountError | StorageError) -> JSONResponse:
        status = 401
        if exc.reason_code in {"email_taken", "username_taken"}:
            status = 409
        elif exc.reason_code == "request_validation_error":
            status = 422
        elif exc.reason_code in {"forbidden"}:
            status = 403
        elif exc.reason_code == "not_found":
            status = 404
        elif exc.reason_code == "storage_not_configured":
            status = 503
        return problem(status, "Account error", exc.message, exc.reason_code)

    def _under_apex(request: Request) -> bool:
        host = (request.url.hostname or "").lower()
        apex = settings.host.lower()
        return host == apex or host.endswith(f".{apex}")

    def _expire_legacy_apex_cookie(request: Request, response: Response) -> None:
        """Kill the pre-host-scoping cookie.

        Sessions used to be issued with Domain=.<apex>. A browser that signed in
        before that changed still carries it, and because a Cookie header can
        hold two entries of the same name, the server sees both and picks the
        legacy one — so admin.<host> resolves to whatever user it names, bounces
        to the product surface, which bounces back. Expiring it is the migration
        that PR #3 should have shipped with the scope change.
        """
        if _under_apex(request):
            response.delete_cookie(
                settings.cookie_name, path="/", domain=f".{settings.host.lower()}"
            )

    # No domain= anywhere below, on purpose. Scoping the cookie to `.<apex>` sent
    # a live session token to every sibling host — mail., s3., rustfs., db. —
    # none of which authenticate anyone, and SameSite=lax does not separate
    # same-site siblings. Host-scoped means app. and admin. hold separate
    # sessions; "View as" bridges them with a one-time hand-off token.
    def _set_cookie(
        request: Request, response: Response, raw: str, *, max_age: int | None = None
    ) -> None:
        response.set_cookie(
            key=settings.cookie_name,
            value=raw,
            httponly=True,
            samesite="lax",
            # https behind the edge, http only for a direct local connection.
            # This is load-bearing on cli.py passing forwarded_allow_ips: uvicorn
            # trusts only 127.0.0.1 by default and Traefik dials from a bridge IP,
            # so without it X-Forwarded-Proto was dropped and the flag never set.
            secure=request.url.scheme == "https",
            max_age=max_age if max_age is not None else int(SESSION_TTL.total_seconds()),
            path="/",
        )
        _expire_legacy_apex_cookie(request, response)

    def _clear_cookie(request: Request, response: Response) -> None:
        response.delete_cookie(
            settings.cookie_name,
            path="/",
            httponly=True,
            samesite="lax",
            secure=request.url.scheme == "https",
        )
        _expire_legacy_apex_cookie(request, response)

    def require_session(request: Request):
        raw = request.cookies.get(settings.cookie_name)
        if not raw:
            raise StarletteHTTPException(
                status_code=401,
                detail={
                    "type": "about:blank",
                    "title": "Unauthenticated",
                    "status": 401,
                    "detail": "sign in required",
                    "reason_code": "unauthenticated",
                },
            )
        with connection(settings) as conn:
            sess = load_session(conn, raw)
        if sess is None:
            raise StarletteHTTPException(
                status_code=401,
                detail={
                    "type": "about:blank",
                    "title": "Unauthenticated",
                    "status": 401,
                    "detail": "sign in required",
                    "reason_code": "unauthenticated",
                },
            )
        return sess

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok", "service": "hull-api"}

    @app.post("/v1/auth/signup", status_code=201)
    def auth_signup(payload: SignupBody, request: Request, response: Response) -> dict[str, Any]:
        try:
            with connection(settings) as conn:
                body, token = signup(
                    conn, username=payload.username, email=payload.email, password=payload.password
                )
                record_event(
                    conn,
                    source="api",
                    event="auth.signup",
                    payload={"email": payload.email.lower()},
                )
                conn.commit()
        except AccountError as exc:
            return _account_http(exc)
        send_mail(
            settings,
            to=payload.email.strip().lower(),
            subject=settings.welcome_subject(),
            text="Your account is ready. Name a workspace to continue.\n",
        )
        _set_cookie(request, response, token)
        return body

    @app.post("/v1/auth/signin")
    def auth_signin(payload: SigninBody, request: Request, response: Response) -> dict[str, Any]:
        try:
            with connection(settings) as conn:
                body, token = signin(conn, email=payload.email, password=payload.password)
                record_event(
                    conn,
                    source="api",
                    event="auth.signin",
                    payload={"email": payload.email.lower()},
                )
                conn.commit()
        except AccountError as exc:
            return _account_http(exc)
        _set_cookie(request, response, token)
        return body

    @app.post("/v1/auth/forgot", status_code=204)
    def auth_forgot(payload: ForgotBody) -> None:
        """Always 204, whether or not that address has an account.

        The response cannot depend on whether the user exists, or this endpoint
        tells anyone who asks which addresses are registered. Traefik already
        rate-limits /v1/auth/*, which is what keeps that from being enumerable by
        volume instead.
        """
        with connection(settings) as conn:
            token = request_password_reset(conn, email=payload.email)
            record_event(
                conn,
                source="api",
                event="auth.forgot",
                payload={"email": payload.email.strip().lower(), "sent": bool(token)},
            )
            conn.commit()
        if not token:
            return
        # The token rides in the fragment, like the support hand-off: fragments
        # are never sent to a server, so it stays out of access logs and out of
        # the Referer of anything the reset page links to.
        link = f"{settings.resolved_public_origin()}/reset#{token}"
        send_mail(
            settings,
            to=payload.email.strip().lower(),
            subject=settings.reset_subject(),
            text=(
                f"Use this link to choose a new password:\n\n{link}\n\n"
                f"It expires in {int(RESET_TTL.total_seconds() // 60)} minutes and works once.\n"
                "If you did not ask for it, nothing has changed and you can ignore this.\n"
            ),
        )

    @app.post("/v1/auth/reset", status_code=204)
    def auth_reset(payload: ResetBody, request: Request, response: Response) -> None:
        try:
            with connection(settings) as conn:
                reset_password(conn, raw=payload.token, password=payload.password)
                record_event(conn, source="api", event="auth.reset", payload={})
                conn.commit()
        except AccountError as exc:
            # A 204 route cannot answer with _account_http's JSONResponse — the
            # declared status would discard the body. Raise, like me_password.
            status = 401 if exc.reason_code == "unauthenticated" else 422
            raise StarletteHTTPException(
                status_code=status,
                detail={
                    "type": "about:blank",
                    "title": "Account error",
                    "status": status,
                    "detail": exc.message,
                    "reason_code": exc.reason_code,
                },
            ) from exc
        # Every session died with the reset, including any this browser was
        # holding. Clear the cookie so the page that follows is honestly signed
        # out instead of carrying a token the server has already forgotten.
        _clear_cookie(request, response)

    @app.post("/v1/auth/signout", status_code=204)
    def auth_signout(request: Request, response: Response) -> None:
        raw = request.cookies.get(settings.cookie_name) or ""
        if raw:
            with connection(settings) as conn:
                signout(conn, raw)
        _clear_cookie(request, response)

    @app.get("/v1/me")
    def me(request: Request, sess=Depends(require_session)) -> dict[str, Any]:
        with connection(settings) as conn:
            return me_body(conn, sess)

    @app.patch("/v1/me")
    def patch_me(
        payload: ProfileBody, request: Request, sess=Depends(require_session)
    ) -> dict[str, Any]:
        # Only forward what the client actually sent, so an omitted field is left
        # alone while an empty one is an explicit clear.
        sent = payload.model_fields_set
        try:
            with connection(settings) as conn:
                update_profile(
                    conn,
                    user_id=sess.user_id,
                    username=payload.username if "username" in sent else None,
                    name=payload.name if "name" in sent else None,
                )
                loaded = load_session(conn, request.cookies.get(settings.cookie_name) or "")
                assert loaded is not None
                return me_body(conn, loaded)
        except AccountError as exc:
            return _account_http(exc)

    @app.post("/v1/me/password", status_code=204)
    def me_password(
        payload: PasswordBody, request: Request, response: Response, sess=Depends(require_session)
    ) -> None:
        try:
            with connection(settings) as conn:
                token = change_password(
                    conn,
                    user_id=sess.user_id,
                    current=payload.current,
                    password=payload.password,
                )
        except AccountError as exc:
            status = 401 if exc.reason_code == "unauthenticated" else 422
            raise StarletteHTTPException(
                status_code=status,
                detail={
                    "type": "about:blank",
                    "title": "Account error",
                    "status": status,
                    "detail": exc.message,
                    "reason_code": exc.reason_code,
                },
            ) from exc
        # Rotate the caller's own token too, so a stolen copy of the current
        # cookie does not survive the password change.
        _set_cookie(request, response, token)

    @app.delete("/v1/me", status_code=204)
    def me_delete(
        payload: CloseBody, request: Request, response: Response, sess=Depends(require_session)
    ) -> None:
        avatar_key = sess.avatar_key
        try:
            with connection(settings) as conn:
                close_account(
                    conn,
                    user_id=sess.user_id,
                    password=payload.password,
                    platform_role=sess.platform_role,
                )
        except AccountError as exc:
            status = 403 if exc.reason_code == "forbidden" else 401
            raise StarletteHTTPException(
                status_code=status,
                detail={
                    "type": "about:blank",
                    "title": "Account error",
                    "status": status,
                    "detail": exc.message,
                    "reason_code": exc.reason_code,
                },
            ) from exc
        # The users row is gone, so nothing can reference the object any more.
        if avatar_key:
            delete_avatar(settings, key=avatar_key)
        _clear_cookie(request, response)

    @app.post("/v1/me/avatar")
    def me_avatar(
        request: Request, file: UploadFile = File(...), sess=Depends(require_session)
    ) -> dict[str, bool]:
        if not s3_enabled(settings):
            return _account_http(
                StorageError("storage_not_configured", "object store is not configured")
            )
        # Bounded read: never materialise more than the cap plus one byte, even if
        # the declared Content-Length that got us past the middleware was a lie.
        data = file.file.read(MAX_AVATAR_BYTES + 1)
        try:
            key = put_avatar(
                settings, user_id=sess.user_id, data=data, content_type=file.content_type or ""
            )
            with connection(settings) as conn:
                set_avatar_key(conn, user_id=sess.user_id, key=key)
        except StorageError as exc:
            return _account_http(exc)
        return {"ok": True}

    @app.get("/v1/me/avatar")
    def me_avatar_get(sess=Depends(require_session)) -> RawResponse:
        if not sess.avatar_key:
            return problem(404, "Not found", "no photo", "not_found")
        try:
            body = get_avatar(settings, key=sess.avatar_key)
        except StorageError as exc:
            return _account_http(exc)
        return RawResponse(content=body, media_type="image/webp")

    @app.post("/v1/orgs", status_code=201)
    def orgs_create(
        payload: OrgBody, request: Request, sess=Depends(require_session)
    ) -> dict[str, Any]:
        raw = request.cookies.get(settings.cookie_name) or ""
        try:
            with connection(settings) as conn:
                body = create_org(conn, user_id=sess.user_id, name=payload.name, raw=raw)
                record_event(conn, source="api", event="org.create", payload={"name": payload.name})
                conn.commit()
                return body
        except AccountError as exc:
            return _account_http(exc)

    @app.post("/v1/session/org")
    def session_org(
        payload: SwitchBody, request: Request, sess=Depends(require_session)
    ) -> dict[str, Any]:
        raw = request.cookies.get(settings.cookie_name) or ""
        try:
            with connection(settings) as conn:
                return switch_org(conn, user_id=sess.user_id, org_id=str(payload.id), raw=raw)
        except AccountError as exc:
            return _account_http(exc)

    @app.get("/v1/admin/users")
    def admin_users(sess=Depends(require_session)) -> dict[str, Any]:
        try:
            require_admin(sess)
        except AccountError as exc:
            return _account_http(exc)
        with connection(settings) as conn:
            return {"users": list_users(conn)}

    @app.get("/v1/admin/orgs")
    def admin_orgs(sess=Depends(require_session)) -> dict[str, Any]:
        try:
            require_admin(sess)
        except AccountError as exc:
            return _account_http(exc)
        with connection(settings) as conn:
            return {"orgs": list_orgs(conn)}

    @app.post("/v1/admin/support")
    def admin_support_start(payload: SupportBody, sess=Depends(require_session)) -> dict[str, Any]:
        """Mint a one-time hand-off token for app.<host>.

        The cookie is host-scoped, so the admin's session does not travel to the
        customer surface. This token does, once, in a URL fragment.
        """
        try:
            require_admin(sess)
            with connection(settings) as conn:
                token = support_start(conn, user_id=sess.user_id, org_id=str(payload.org_id))
                record_event(
                    conn,
                    source="api",
                    event="support.impersonate",
                    org_id=str(payload.org_id),
                    payload={"actor": sess.email},
                )
                conn.commit()
                return {"handoff": token}
        except AccountError as exc:
            return _account_http(exc)

    @app.post("/v1/session/handoff")
    def session_handoff(
        payload: HandoffBody, request: Request, response: Response
    ) -> dict[str, Any]:
        """Exchange a hand-off token for a session on this host.

        Deliberately unauthenticated: the browser arrives here with no cookie for
        this host — that is the whole point of the hand-off.
        """
        try:
            with connection(settings) as conn:
                body, token = consume_handoff(conn, raw=payload.token)
        except AccountError as exc:
            return _account_http(exc)
        _set_cookie(request, response, token, max_age=int(SUPPORT_TTL.total_seconds()))
        return body

    @app.delete("/v1/admin/support", status_code=204)
    def admin_support_stop(
        request: Request, response: Response, sess=Depends(require_session)
    ) -> None:
        """End impersonation by ending the session it lives on."""
        with connection(settings) as conn:
            support_stop(conn, raw=request.cookies.get(settings.cookie_name) or "")
            record_event(conn, source="api", event="support.stop", payload={"actor": sess.email})
            conn.commit()
        _clear_cookie(request, response)

    return app
