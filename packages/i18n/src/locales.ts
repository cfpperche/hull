/**
 * Which languages exist, and how one is chosen.
 *
 * The ladder is in ADR-0016 and has three rungs: the person's stored choice,
 * then what the browser asks for, then English. `negotiate` is the second rung
 * and nothing else — it never reads storage and never guesses from a timezone.
 */

/** English first: it is the fallback, and the order is what `check` compares against. */
export const LOCALES = ["en", "pt-BR"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** What each language calls itself. A picker that lists "Portuguese (Brazil)"
 *  in English is a picker for people who already read English. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  "pt-BR": "Português (Brasil)",
};

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" && (LOCALES as readonly string[]).includes(value)
  );
}

/**
 * Pick the best of ours for what the caller asked for.
 *
 * Takes either an `Accept-Language` header verbatim or `navigator.languages`,
 * because those are the two shapes this is ever handed and normalising them at
 * the call site would mean writing the q-value parser twice.
 */
export function negotiate(
  wanted: string | readonly string[] | null | undefined,
): Locale {
  return best(wanted, LOCALES, DEFAULT_LOCALE);
}

/**
 * The algorithm, over any list. `negotiate` is this with ours filled in.
 *
 * It takes the list rather than closing over `LOCALES` so that the exact-match
 * pass below can be *observed*. With one Portuguese in the set, deleting that
 * pass changes no answer `negotiate` can give — the near-match pass covers every
 * case — so a selftest written against `negotiate` would assert nothing while
 * appearing to assert something. This repo has shipped that mistake twice; here
 * the fix is one parameter.
 */
export function best<T extends string>(
  wanted: string | readonly string[] | null | undefined,
  available: readonly T[],
  fallback: T,
): T {
  const tags = parseWanted(wanted);
  for (const tag of tags) {
    const exact = available.find((l) => l.toLowerCase() === tag);
    if (exact) return exact;
  }
  // Then by base language: `pt`, `pt-PT` and `pt-br` all land on `pt-BR`, which
  // is the only Portuguese we have. Serving a Portuguese reader Brazilian
  // Portuguese is a small wrong; serving them English is a bigger one.
  for (const tag of tags) {
    const base = tag.split("-")[0];
    const near = available.find((l) => l.toLowerCase().split("-")[0] === base);
    if (near) return near;
  }
  return fallback;
}

/** Lowercased tags, best first. `*` is dropped: it means "anything", which is
 *  what the fallback already is. */
function parseWanted(
  wanted: string | readonly string[] | null | undefined,
): string[] {
  if (!wanted) return [];
  const raw = typeof wanted === "string" ? wanted.split(",") : [...wanted];
  return (
    raw
      .map((part) => {
        const [tag, ...params] = part.trim().split(";");
        const q = params
          .map((p) => p.trim())
          .find((p) => p.startsWith("q="))
          ?.slice(2);
        const weight = q === undefined ? 1 : Number.parseFloat(q);
        return {
          tag: tag.trim().toLowerCase(),
          q: Number.isFinite(weight) ? weight : 0,
        };
      })
      .filter((e) => e.tag && e.tag !== "*" && e.q > 0)
      // Stable within equal weights, so the header's own order still decides.
      .sort((a, b) => b.q - a.q)
      .map((e) => e.tag)
  );
}
