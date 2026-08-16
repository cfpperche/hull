export type HullUser = {
  id: string;
  email: string;
  username: string | null;
  name: string | null;
  has_avatar: boolean;
};

export type HullOrg = { id: string; name: string };

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
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`${prefix}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) {
    const p = data as Partial<Problem>;
    throw new ApiError({
      title: p.title || "Error",
      detail: p.detail || res.statusText,
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
    me: () => request<HullMe>(prefix, "/v1/me"),
    createOrg: (body: { name: string }) =>
      request<HullMe>(prefix, "/v1/orgs", { method: "POST", body: JSON.stringify(body) }),
    switchOrg: (id: string) =>
      request<HullMe>(prefix, "/v1/session/org", { method: "POST", body: JSON.stringify({ id }) }),
    updateMe: (body: { username?: string; name?: string }) =>
      request<HullMe>(prefix, "/v1/me", { method: "PATCH", body: JSON.stringify(body) }),
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
    supportStart: (orgId: string) =>
      request<HullMe>(prefix, "/v1/admin/support", {
        method: "POST",
        body: JSON.stringify({ org_id: orgId }),
      }),
    supportStop: () => request<HullMe>(prefix, "/v1/admin/support", { method: "DELETE" }),
  };
}

export function parseRequired(value: string, field: string): string | null {
  const t = value.trim();
  return t ? t : `${field} is required`;
}
