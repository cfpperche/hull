/**
 * The gate. `pnpm --filter @hull/i18n check`, and CI runs it.
 *
 * TypeScript already refuses a catalog with a missing or invented key, which
 * covers the common mistake — but only where somebody runs `tsc`. This is the
 * same comparison plus the one TypeScript cannot make: a translated phrase that
 * dropped a hole. `"Usado"` where the English says `"Last used {ago}"` type
 * checks perfectly and ships a sentence with the value missing from it.
 *
 * A screen half in Portuguese reads as a defect, so an incomplete locale must
 * not compile. → ADR-0016
 */
import { en } from "./catalogs/en";
import { ptBR } from "./catalogs/pt-BR";
import { LOCALES, DEFAULT_LOCALE, type Locale } from "./locales";
import { holes } from "./translate";
import { MANIFEST, current } from "./manifest";
import { selftest } from "./selftest";

const assertions = selftest();

const CATALOGS: Record<Locale, Record<string, string>> = { en, "pt-BR": ptBR };

const problems: string[] = [];
const base = CATALOGS[DEFAULT_LOCALE];
const baseKeys = Object.keys(base);

for (const key of baseKeys) {
  if (!base[key].trim()) problems.push(`${DEFAULT_LOCALE}: ${key} is empty`);
}

for (const locale of LOCALES) {
  if (locale === DEFAULT_LOCALE) continue;
  const strings = CATALOGS[locale];
  // A locale added to LOCALES with no catalog behind it. Reported rather than
  // left to crash on the first lookup: the stack trace names `check.ts`, which
  // is the one file that is not the problem.
  if (!strings) {
    problems.push(`${locale}: listed in LOCALES but has no catalog in src/catalogs/`);
    continue;
  }

  for (const key of baseKeys) {
    if (!(key in strings)) {
      problems.push(`${locale}: missing ${key}`);
      continue;
    }
    if (!strings[key].trim()) {
      problems.push(`${locale}: ${key} is empty`);
      continue;
    }
    // Order is the translator's business; the set is not.
    const want = [...new Set(holes(base[key]))].sort();
    const got = [...new Set(holes(strings[key]))].sort();
    if (want.join(",") !== got.join(",")) {
      problems.push(
        `${locale}: ${key} expects {${want.join("} {")}} but has ${
          got.length ? `{${got.join("} {")}}` : "no holes"
        }`,
      );
    }
  }

  for (const key of Object.keys(strings)) {
    if (!(key in base)) problems.push(`${locale}: ${key} is not a key in ${DEFAULT_LOCALE}`);
  }
}

// The list Python reads. Generated, so the two cannot disagree — but only if
// somebody reran the build after adding a locale.
if (!current()) {
  problems.push(`${MANIFEST} is out of date — run: pnpm --filter @hull/i18n build`);
}

if (problems.length) {
  console.error("✗ catalogs disagree:\n");
  for (const p of problems) console.error(`  ${p}`);
  console.error(`\n${problems.length} problem(s). Fix packages/i18n/src/catalogs/.`);
  process.exit(1);
}

console.log(
  `I18N_CHECK_OK ${LOCALES.length} locales, ${baseKeys.length} keys, ${assertions} assertions`,
);
