export type HullSurface = "www" | "web" | "admin";

export type PublicConfig = {
  host: string;
  brand: string;
  mark: string;
};

const FALLBACK: PublicConfig = { host: "hull.dev", brand: "Hull", mark: "H" };

let cached: PublicConfig | null = null;

export function brandSlug(brand: string): string {
  const slug = brand.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return slug || "hull";
}

export function themeStorageKey(brand: string): string {
  return `${brandSlug(brand)}-theme`;
}

export async function loadPublicConfig(): Promise<PublicConfig> {
  if (cached) return cached;
  const res = await fetch("/config.json", { cache: "no-store" });
  if (!res.ok) {
    throw new Error("config.json missing — run scripts/render-brand.sh");
  }
  const raw = (await res.json()) as Partial<PublicConfig>;
  const brand = (raw.brand || FALLBACK.brand).trim() || FALLBACK.brand;
  const mark = ((raw.mark || brand).trim() || brand).slice(0, 1) || "H";
  cached = {
    host: (raw.host || FALLBACK.host).trim() || FALLBACK.host,
    brand,
    mark,
  };
  return cached;
}

export function publicConfig(): PublicConfig {
  if (!cached) throw new Error("loadPublicConfig first");
  return cached;
}

export function originFor(surface: HullSurface, host = publicConfig().host): string {
  if (surface === "www") return `https://${host}`;
  if (surface === "web") return `https://app.${host}`;
  return `https://admin.${host}`;
}

export const SESSION_COOKIE = "hull_session";
export const API_PREFIX = "/api";
