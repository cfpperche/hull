import {
  Fragment,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  createT,
  isLocale,
  negotiate,
  type Locale,
  type Segment,
  type T,
} from "@hull/i18n";

/**
 * Which language this browser is reading, and the `t` that follows from it.
 *
 * **Outermost, above BrandGate.** Every other provider has something to say to
 * a person — "Loading…", "Something broke", "config.json missing" — and a
 * provider that renders text has to be inside this one or its text cannot be
 * translated. That is why the account's stored choice arrives through a setter
 * rather than a prop: the session lives several layers down, and nesting a
 * second provider under it would give the document two `lang` effects racing to
 * write the same attribute, child first.
 *
 * The ladder from ADR-0016, top rung first: `setLocale` when a session brings a
 * stored choice, then the browser, then English.
 */
type Ctx = { t: T; setLocale: (locale: string | null | undefined) => void };

const LocaleContext = createContext<Ctx | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [chosen, setChosen] = useState<Locale | null>(null);
  // Read once. `navigator.languages` does not change while a page is open, and
  // recomputing it per render would make `resolved` a new value every time.
  const [fromBrowser] = useState<Locale>(() =>
    negotiate(typeof navigator === "undefined" ? null : navigator.languages),
  );
  const resolved = chosen ?? fromBrowser;

  // `lang` on the document, not in index.html, for the same reason the brand is
  // not baked into the bundle: it is a per-reader value, and there is one build.
  // Screen readers pick a voice from it and the browser hyphenates by it, so a
  // page of Portuguese under lang="en" is read aloud in an English accent.
  useEffect(() => {
    document.documentElement.lang = resolved;
  }, [resolved]);

  // Anything unrecognised clears the choice rather than sticking: a locale the
  // account holds but this build no longer ships should fall back down the
  // ladder, not freeze on a catalog that does not exist.
  const setLocale = useCallback((locale: string | null | undefined) => {
    setChosen(isLocale(locale) ? locale : null);
  }, []);

  const value = useMemo(
    () => ({ t: createT(resolved), setLocale }),
    [resolved, setLocale],
  );
  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

function ctx(): Ctx {
  const found = useContext(LocaleContext);
  if (!found) throw new Error("useT requires LocaleProvider");
  return found;
}

/** The translator. `t("auth.signIn")`, or `t.parts(...)` when a hole takes a node. */
export function useT(): T {
  return ctx().t;
}

/** The resolved locale, for `Intl` formatters. Never `undefined` — that is the
 *  bug ADR-0016 opens with. */
export function useLocale(): Locale {
  return ctx().t.locale;
}

/**
 * Hand the provider the account's stored choice. One caller per app: a shim
 * inside the session provider, which is the only place that knows there is one.
 */
export function useAccountLocale(locale: string | null | undefined): void {
  const { setLocale } = ctx();
  useEffect(() => {
    setLocale(locale);
  }, [locale, setLocale]);
}

/**
 * A translated sentence whose holes take nodes rather than text.
 *
 * Half the sentences on an account page name an address and want it emphasised.
 * The alternative is splitting the sentence around the emphasised part, which is
 * exactly the fragment key ADR-0016 refuses: word order is the translator's to
 * change, and they cannot change it if the sentence arrives in three pieces.
 *
 * `packages/email` has its own copy of these ten lines, and should. It renders
 * for mail clients, and importing `@hull/ui` would pull Tailwind and a browser
 * component library into a build whose output is inline-styled tables.
 */
export function Fill({
  parts,
  nodes,
}: {
  parts: Segment[];
  nodes: Record<string, ReactNode>;
}) {
  return (
    <>
      {parts.map((part, i) =>
        typeof part === "string" ? (
          <Fragment key={i}>{part}</Fragment>
        ) : (
          // A hole with no node is left standing, for the same reason `fill`
          // leaves one standing: "{email}" is a bug somebody reports, an empty
          // gap is one that ships.
          <Fragment key={i}>{nodes[part.hole] ?? `{${part.hole}}`}</Fragment>
        ),
      )}
    </>
  );
}
