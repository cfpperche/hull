export type HullSurface = "www" | "web" | "admin";

const DEFAULT_HOST = "hull.dev";

export function hullHost(): string {
  return (import.meta as { env?: { VITE_HULL_HOST?: string } }).env?.VITE_HULL_HOST
    || DEFAULT_HOST;
}

export function originFor(surface: HullSurface, host = hullHost()): string {
  if (surface === "www") return `https://${host}`;
  if (surface === "web") return `https://app.${host}`;
  return `https://admin.${host}`;
}

export const SESSION_COOKIE = "hull_session";
export const API_PREFIX = "/api";
