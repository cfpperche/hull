/**
 * Lookup and interpolation. Sixty lines, and that is the whole argument for not
 * taking an i18n library — see ADR-0016.
 */
import { en, type Catalog, type MessageKey } from "./catalogs/en";
import { ptBR } from "./catalogs/pt-BR";
import { DEFAULT_LOCALE, type Locale } from "./locales";

const CATALOGS: Record<Locale, Catalog> = { en, "pt-BR": ptBR };

export function catalog(locale: Locale): Catalog {
  return CATALOGS[locale] ?? CATALOGS[DEFAULT_LOCALE];
}

export type Values = Record<string, string | number>;

/**
 * `{name}`, but never the `{name}` inside a `{{name}}`.
 *
 * The two layers nest: a mail string is filled here at build time with values
 * that are themselves `{{holes}}` for `hull_fastapi` to fill at send. Without
 * the lookarounds, `segments` splits `{{brand}}` into three pieces, React puts
 * its comment separators between adjacent text nodes, and the generated HTML
 * carries `{<!-- -->{brand}<!-- -->}` — a hole the adapter can no longer see and
 * a brand name delivered as literal braces. Found by a test, in a message that
 * had already been rendered.
 */
const HOLE = /(?<!\{)\{([a-zA-Z][a-zA-Z0-9]*)\}(?!\})/g;

/** The names a phrase expects. Used by `check` to compare locales, and by the
 *  mail build to prove the JSX is passing what the sentence asks for. */
export function holes(template: string): string[] {
  return [...template.matchAll(HOLE)].map((m) => m[1]);
}

/**
 * A hole with no value is left standing rather than blanked.
 *
 * `Hello {name}` with nothing to put in it is a bug either way, but "Hello
 * {name}" is a bug somebody reports and "Hello " is one that ships. The mail
 * build refuses to write a template with a hole it cannot account for; this is
 * the browser's version of the same choice, minus the ability to fail a build.
 */
export function fill(template: string, values?: Values): string {
  if (!values) return template;
  return template.replace(HOLE, (whole, name: string) =>
    name in values ? String(values[name]) : whole,
  );
}

/**
 * The same substitution, but stopping one step short so the caller can put
 * something other than text in the hole.
 *
 * This exists because half the sentences that name an address want it in bold,
 * and the alternative — splitting the sentence around the bold part — is
 * exactly the fragment key ADR-0016 refuses. Word order is the translator's to
 * change; they cannot change it if the sentence arrives in three pieces.
 */
export type Segment = string | { hole: string };

export function segments(template: string): Segment[] {
  const out: Segment[] = [];
  let at = 0;
  for (const m of template.matchAll(HOLE)) {
    if (m.index > at) out.push(template.slice(at, m.index));
    out.push({ hole: m[1] });
    at = m.index + m[0].length;
  }
  if (at < template.length) out.push(template.slice(at));
  return out;
}

/**
 * A key whose phrase changes with a count. Written as two keys, `…one` and
 * `…other`, and looked up with `t.plural`.
 *
 * The suffixes are CLDR's own category names, chosen so the day a locale needs
 * a third — Polish has `few`, Russian has `many` — it is a key, not a rewrite.
 * Only `one` and `other` are required, and anything else falls back to `other`:
 * pt-BR technically has a `many` for compact numbers like "1,2 milhão", and
 * demanding a separate translation of "session" for it would be ceremony.
 */
type StemOf<K> = K extends `${infer B}.one` ? B : never;

/** Distributed through `StemOf` deliberately: a conditional applied to a union
 *  directly tests the whole union at once and quietly resolves to `never`. */
export type PluralKey = StemOf<MessageKey>;

export type T = {
  (key: MessageKey, values?: Values): string;
  /** The phrase, split at its holes, for a caller that fills them with nodes. */
  parts(key: MessageKey, values?: Values): Segment[];
  /**
   * The phrase for this count. `n` is passed through as `{n}` so the sentence
   * can put the number where its own grammar wants it.
   */
  plural(key: PluralKey, n: number, values?: Values): string;
  locale: Locale;
};

export function createT(locale: Locale): T {
  const strings = catalog(locale);
  const rules = new Intl.PluralRules(locale);
  const t = ((key: MessageKey, values?: Values) =>
    fill(strings[key], values)) as T;
  t.parts = (key: MessageKey, values?: Values) =>
    segments(fill(strings[key], values));
  t.plural = (key: PluralKey, n: number, values?: Values) => {
    const category = rules.select(n);
    const exact = `${key}.${category}` as MessageKey;
    const chosen = exact in strings ? exact : (`${key}.other` as MessageKey);
    return fill(strings[chosen], { n, ...values });
  };
  t.locale = locale;
  return t;
}
