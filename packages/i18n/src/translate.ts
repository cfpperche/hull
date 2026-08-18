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

const HOLE = /\{([a-zA-Z][a-zA-Z0-9]*)\}/g;

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

export type T = {
  (key: MessageKey, values?: Values): string;
  /** The phrase, split at its holes, for a caller that fills them with nodes. */
  parts(key: MessageKey, values?: Values): Segment[];
  locale: Locale;
};

export function createT(locale: Locale): T {
  const strings = catalog(locale);
  const t = ((key: MessageKey, values?: Values) => fill(strings[key], values)) as T;
  t.parts = (key: MessageKey, values?: Values) => segments(fill(strings[key], values));
  t.locale = locale;
  return t;
}
