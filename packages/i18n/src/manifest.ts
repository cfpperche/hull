/**
 * The locale list, written where Python can read it.
 *
 * `hull_fastapi` has to validate what arrives on `PATCH /v1/me` and pick a mail
 * template by locale, and both need to know which locales exist. A tuple in
 * Python beside the one in `locales.ts` is two sources of truth for the same
 * fact — and the drift is silent, because a locale missing from the Python copy
 * just quietly stops being offered.
 *
 * So the list is generated, the same way the mail bodies are:
 *
 *   pnpm --filter @hull/i18n build     write
 *   pnpm --filter @hull/i18n check     verify, without writing (CI)
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_LOCALE, LOCALES, LOCALE_NAMES } from "./locales";

const HERE = dirname(fileURLToPath(import.meta.url));
export const MANIFEST = join(
  HERE,
  "../../../adapters/fastapi/src/hull_fastapi/locales.json",
);

export function render(): string {
  return `${JSON.stringify(
    { default: DEFAULT_LOCALE, locales: LOCALES, names: LOCALE_NAMES },
    null,
    2,
  )}\n`;
}

/** Returns true when the file on disk already matches. */
export function current(): boolean {
  return existsSync(MANIFEST) && readFileSync(MANIFEST, "utf8") === render();
}

export function write(): void {
  writeFileSync(MANIFEST, render());
}
