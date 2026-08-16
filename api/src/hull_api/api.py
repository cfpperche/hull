from __future__ import annotations

from typing import Any

from fastapi import Depends, FastAPI, File, Request, Response, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response as RawResponse
from pydantic import BaseModel, Field
from starlette.exceptions import HTTPException as StarletteHTTPException

from hull_api.accounts import (
    AccountError,
    SESSION_TTL,
    change_password,
    close_account,
    create_org,
    list_orgs,
    list_users,
    load_session,
    me_body,
    require_admin,
    set_avatar_key,
    signin,
    signout,
    signup,
    support_start,
    support_stop,
    switch_org,
    update_profile,
)
from hull_api.config import Settings
from hull_api.db import connection
from hull_api.mail import send_mail
from hull_api.observe import record_event
from hull_api.storage import StorageError, get_avatar, put_avatar, s3_enabled

PROBLEM_JSON = "application/problem+json"


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
    id: str


class ProfileBody(BaseModel):
    username: str | None = None
    name: str | None = None


class PasswordBody(BaseModel):
    current: str
    password: str


class CloseBody(BaseModel):
    password: str


class SupportBody(BaseModel):
    org_id: str = Field(min_length=1)


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()
    app = FastAPI(title="hull-api", version="0.1.0", root_path=(settings.root_path or "").rstrip("/"))
    app.state.settings = settings

    origins = [o.strip() for o in (settings.cors_origins or "").split(",") if o.strip()]
    if not origins:
        origins = [
            f"https://{settings.host}",
            f"https://www.{settings.host}",
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
            return JSONResponse(status_code=exc.status_code, content=detail, media_type=PROBLEM_JSON)
        if exc.status_code == 404:
            return problem(404, "Not found", "Not found", "not_found")
        return problem(exc.status_code, "Error", str(detail), "http_error")

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

    def _cookie_domain(request: Request) -> str | None:
        host = (request.url.hostname or "").lower()
        apex = settings.host.lower()
        if host == apex or host.endswith(f".{apex}"):
            return f".{apex}"
        return None

    def _set_cookie(request: Request, response: Response, raw: str) -> None:
        response.set_cookie(
            key=settings.cookie_name,
            value=raw,
            httponly=True,
            samesite="lax",
            secure=request.url.scheme == "https",
            max_age=int(SESSION_TTL.total_seconds()),
            path="/",
            domain=_cookie_domain(request),
        )

    def _clear_cookie(request: Request, response: Response) -> None:
        response.delete_cookie(settings.cookie_name, path="/", domain=_cookie_domain(request))

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
                record_event(conn, source="api", event="auth.signup", payload={"email": payload.email.lower()})
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
                record_event(conn, source="api", event="auth.signin", payload={"email": payload.email.lower()})
                conn.commit()
        except AccountError as exc:
            return _account_http(exc)
        _set_cookie(request, response, token)
        return body

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
    def patch_me(payload: ProfileBody, request: Request, sess=Depends(require_session)) -> dict[str, Any]:
        try:
            with connection(settings) as conn:
                update_profile(conn, user_id=sess.user_id, username=payload.username, name=payload.name)
                loaded = load_session(conn, request.cookies.get(settings.cookie_name) or "")
                assert loaded is not None
                return me_body(conn, loaded)
        except AccountError as exc:
            return _account_http(exc)

    @app.post("/v1/me/password", status_code=204)
    def me_password(payload: PasswordBody, request: Request, sess=Depends(require_session)) -> None:
        raw = request.cookies.get(settings.cookie_name) or ""
        try:
            with connection(settings) as conn:
                change_password(
                    conn,
                    user_id=sess.user_id,
                    current=payload.current,
                    password=payload.password,
                    keep_raw=raw,
                )
        except AccountError as exc:
            raise StarletteHTTPException(
                status_code=401 if exc.reason_code == "unauthenticated" else 422,
                detail={
                    "type": "about:blank",
                    "title": "Account error",
                    "status": 401,
                    "detail": exc.message,
                    "reason_code": exc.reason_code,
                },
            ) from exc

    @app.delete("/v1/me", status_code=204)
    def me_delete(payload: CloseBody, request: Request, response: Response, sess=Depends(require_session)) -> None:
        try:
            with connection(settings) as conn:
                close_account(conn, user_id=sess.user_id, password=payload.password, platform_role=sess.platform_role)
        except AccountError as exc:
            raise StarletteHTTPException(
                status_code=403 if exc.reason_code == "forbidden" else 401,
                detail={
                    "type": "about:blank",
                    "title": "Account error",
                    "status": 401,
                    "detail": exc.message,
                    "reason_code": exc.reason_code,
                },
            ) from exc
        _clear_cookie(request, response)

    @app.post("/v1/me/avatar")
    def me_avatar(request: Request, file: UploadFile = File(...), sess=Depends(require_session)) -> dict[str, bool]:
        if not s3_enabled(settings):
            return _account_http(StorageError("storage_not_configured", "object store is not configured"))
        data = file.file.read()
        try:
            key = put_avatar(settings, user_id=sess.user_id, data=data, content_type=file.content_type or "")
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
    def orgs_create(payload: OrgBody, request: Request, sess=Depends(require_session)) -> dict[str, Any]:
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
    def session_org(payload: SwitchBody, request: Request, sess=Depends(require_session)) -> dict[str, Any]:
        raw = request.cookies.get(settings.cookie_name) or ""
        try:
            with connection(settings) as conn:
                return switch_org(conn, user_id=sess.user_id, org_id=payload.id, raw=raw)
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
    def admin_support_start(payload: SupportBody, request: Request, sess=Depends(require_session)) -> dict[str, Any]:
        try:
            require_admin(sess)
            with connection(settings) as conn:
                body = support_start(conn, raw=request.cookies.get(settings.cookie_name) or "", org_id=payload.org_id)
                record_event(
                    conn,
                    source="api",
                    event="support.impersonate",
                    org_id=payload.org_id,
                    payload={"actor": sess.email},
                )
                conn.commit()
                return body
        except AccountError as exc:
            return _account_http(exc)

    @app.delete("/v1/admin/support")
    def admin_support_stop(request: Request, sess=Depends(require_session)) -> dict[str, Any]:
        try:
            require_admin(sess)
            with connection(settings) as conn:
                body = support_stop(conn, raw=request.cookies.get(settings.cookie_name) or "")
                record_event(conn, source="api", event="support.stop", payload={"actor": sess.email})
                conn.commit()
                return body
        except AccountError as exc:
            return _account_http(exc)

    return app
