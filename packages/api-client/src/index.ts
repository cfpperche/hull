export type HullUser = {
  id: string;
  email: string;
  username: string | null;
  name: string | null;
  has_avatar: boolean;
  email_verified: boolean;
};

export type HullOrg = { id: string; name: string };

export type HullSession = {
  id: string;
  /** A short reading of the User-Agent. Self-reported, so not a guarantee. */
  device: string;
  created_at: string;
  last_seen_at: string;
  /** Taken to view a customer's workspace, not to use the product. */
  support: boolean;
  current: boolean;
};

export type HullMe = {
  user: HullUser;
  org: HullOrg | null;
  orgs: HullOrg[];
  platform_role: string | null;
  acting: { org: HullOrg; expires_at: string } | null;
};

export type Problem = {
  title: string;
  detail: string;
  status: number;
  reason_code: string;
};

export class ApiError extends Error {
  readonly problem: Problem;
  constructor(problem: Problem) {
    super(problem.detail || problem.title);
    this.problem = problem;
  }
}

export function errMsg(err: unknown): string {
  if (err instanceof ApiError) return err.problem.detail;
  if (err instanceof Error) return err.message;
  return "Request failed";
}

type ClientOpts = { prefix?: string };

async function request<T>(
  prefix: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  // Only for string bodies. Setting it for a FormData body suppresses the
  // multipart boundary fetch would otherwise generate, which made every
  // avatar upload unparseable on the server.
  if (typeof init.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`${prefix}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  // An edge 502 or any other non-JSON body must still surface as an ApiError
  // carrying the real status — a raw SyntaxError escapes the 401 handling in
  // the session provider and gets rendered to the user verbatim.
  let data: unknown = null;
  try {
    data = text ? (JSON.parse(text) as unknown) : null;
  } catch {
    data = null;
  }
  if (res.status === 429) {
    // The edge rate-limits /v1/auth/* and answers "Too Many Requests" as plain
    // text, so the generic branch below fell through to res.statusText — empty
    // over HTTP/2 — and every throttled user was told "Request failed". That is
    // a dead end that invites them to hammer the button. Retry-After is right
    // there in the response.
    const after = Number(res.headers.get("retry-after"));
    const wait =
      Number.isFinite(after) && after > 0 ? `Try again in ${after}s.` : "Try again shortly.";
    throw new ApiError({
      title: "Too many attempts",
      detail: `Too many attempts. ${wait}`,
      status: 429,
      reason_code: "rate_limited",
    });
  }
  if (!res.ok) {
    const p = (data && typeof data === "object" ? data : {}) as Partial<Problem>;
    throw new ApiError({
      title: p.title || "Error",
      detail: p.detail || res.statusText || "Request failed",
      status: res.status,
      reason_code: p.reason_code || "http_error",
    });
  }
  return data as T;
}

export function createApi(opts: ClientOpts = {}) {
  const prefix = opts.prefix ?? "/api";
  return {
    health: () => request<{ status: string }>(prefix, "/health"),
    signup: (body: { username: string; email: string; password: string }) =>
      request<HullMe>(prefix, "/v1/auth/signup", { method: "POST", body: JSON.stringify(body) }),
    signin: (body: { email: string; password: string }) =>
      request<HullMe>(prefix, "/v1/auth/signin", { method: "POST", body: JSON.stringify(body) }),
    signout: () => request<void>(prefix, "/v1/auth/signout", { method: "POST" }),
    verifyEmail: (token: string) =>
      request<void>(prefix, "/v1/auth/verify", { method: "POST", body: JSON.stringify({ token }) }),
    // Resolves whether or not a mail went out: a verified address has no state
    // to change, and saying so would only be noise.
    resendVerification: () => request<void>(prefix, "/v1/me/verify", { method: "POST" }),
    // Resolves the same way whether or not the address has an account. Do not
    // branch the UI on it — that would put the oracle back in the client.
    forgotPassword: (body: { email: string }) =>
      request<void>(prefix, "/v1/auth/forgot", { method: "POST", body: JSON.stringify(body) }),
    resetPassword: (body: { token: string; password: string }) =>
      request<void>(prefix, "/v1/auth/reset", { method: "POST", body: JSON.stringify(body) }),
    me: () => request<HullMe>(prefix, "/v1/me"),
    createOrg: (body: { name: string }) =>
      request<HullMe>(prefix, "/v1/orgs", { method: "POST", body: JSON.stringify(body) }),
    switchOrg: (id: string) =>
      request<HullMe>(prefix, "/v1/session/org", { method: "POST", body: JSON.stringify({ id }) }),
    updateMe: (body: { username?: string; name?: string }) =>
      request<HullMe>(prefix, "/v1/me", { method: "PATCH", body: JSON.stringify(body) }),
    listSessions: () => request<{ sessions: HullSession[] }>(prefix, "/v1/me/sessions"),
    revokeSession: (id: string) =>
      request<void>(prefix, `/v1/me/sessions/${id}`, { method: "DELETE" }),
    /** Everywhere but here. The caller's own session deliberately survives. */
    revokeOtherSessions: () => request<void>(prefix, "/v1/me/sessions", { method: "DELETE" }),
    /**
     * Asks; does not change. The current address stays live until the new one
     * redeems its link, so do not update anything on-screen from this call.
     */
    changeEmail: (body: { password: string; email: string }) =>
      request<void>(prefix, "/v1/me/email", { method: "POST", body: JSON.stringify(body) }),
    confirmEmailChange: (token: string) =>
      request<void>(prefix, "/v1/auth/email", { method: "POST", body: JSON.stringify({ token }) }),
    changePassword: (body: { current: string; password: string }) =>
      request<void>(prefix, "/v1/me/password", { method: "POST", body: JSON.stringify(body) }),
    closeAccount: (body: { password: string }) =>
      request<void>(prefix, "/v1/me", { method: "DELETE", body: JSON.stringify(body) }),
    avatarUrl: () => `${prefix}/v1/me/avatar`,
    uploadAvatar: (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return request<{ ok: boolean }>(prefix, "/v1/me/avatar", { method: "POST", body: fd });
    },
    adminUsers: () =>
      request<{ users: Array<HullUser & { platform_role: string | null; created_at: string }> }>(
        prefix,
        "/v1/admin/users",
      ),
    adminOrgs: () =>
      request<{ orgs: Array<HullOrg & { created_at: string }> }>(prefix, "/v1/admin/orgs"),
    /**
     * Returns a one-time hand-off token, not a session. The cookie is
     * host-scoped, so the admin's session does not reach app.<host>; the token
     * is what travels, once, in a URL fragment.
     */
    supportStart: (orgId: string) =>
      request<{ handoff: string }>(prefix, "/v1/admin/support", {
        method: "POST",
        body: JSON.stringify({ org_id: orgId }),
      }),
    /** Exchange the hand-off token for a session on this host. */
    consumeHandoff: (token: string) =>
      request<HullMe>(prefix, "/v1/session/handoff", {
        method: "POST",
        body: JSON.stringify({ token }),
      }),
    /** Ends the impersonating session itself, so the cookie is cleared too. */
    supportStop: () => request<void>(prefix, "/v1/admin/support", { method: "DELETE" }),
  };
}

export function parseRequired(value: string, field: string): string | null {
  const t = value.trim();
  return t ? t : `${field} is required`;
}
