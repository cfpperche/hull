import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { createT, isLocale, negotiate, type Locale, type T } from "@hull/i18n";

/**
 * Which language this browser is reading, and the `t` that follows from it.
 *
 * The ladder from ADR-0016, with the top rung supplied by the caller: each app
 * knows where its session lives, this package deliberately does not. Pass
 * `me?.user.locale` and a signed-out screen falls through to the browser's own
 * preference, which is the correct answer for someone who has no account yet.
 */
const LocaleContext = createContext<T | null>(null);

export function LocaleProvider({
  locale,
  children,
}: {
  /** The stored choice, when there is a session. */
  locale?: string | null;
  children: ReactNode;
}) {
  const resolved: Locale = isLocale(locale)
    ? locale
    : negotiate(typeof navigator === "undefined" ? null : navigator.languages);

  // `lang` on the document, not in index.html, for the same reason the brand is
  // not baked into the bundle: it is a per-reader value, and there is one build.
  // Screen readers pick a voice from it and the browser hyphenates by it, so a
  // page of Portuguese under lang="en" is read aloud in an English accent.
  useEffect(() => {
    document.documentElement.lang = resolved;
  }, [resolved]);

  const t = useMemo(() => createT(resolved), [resolved]);
  return <LocaleContext.Provider value={t}>{children}</LocaleContext.Provider>;
}

/** The translator. `t("auth.signIn")`, or `t.parts(...)` when a hole takes a node. */
export function useT(): T {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useT requires LocaleProvider");
  return ctx;
}

/** The resolved locale, for `Intl` formatters. Never `undefined` — that is the
 *  bug ADR-0016 opens with. */
export function useLocale(): Locale {
  return useT().locale;
}
