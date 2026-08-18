/**
 * Find user-visible text that never made it into the catalog.
 *
 * The completeness check proves the two locales agree with each other. It says
 * nothing about a sentence typed straight into a screen, which is how the
 * product got here in the first place — and how it would get back, one
 * convenient `<h2>Billing</h2>` at a time.
 *
 * A heuristic, deliberately: JSX text nodes and the handful of props that are
 * read by a person. It will not catch everything and it will occasionally be
 * wrong, which is why `// i18n-ignore` on the line above silences it. A rule
 * with no way out gets deleted rather than respected.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../../..");

const ROOTS = [
  "apps/www/src",
  "apps/web/src",
  "apps/admin/src",
  "packages/ui/src",
];

/** Props a person reads. `title` and `label` are the ones that hide. */
const SPOKEN = [
  "title",
  "description",
  "label",
  "placeholder",
  "aria-label",
  "confirmLabel",
  "cancelLabel",
  "pendingLabel",
  "brandHint",
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.tsx?$/.test(path)) out.push(path);
  }
  return out;
}

export type Finding = { file: string; line: number; text: string };

export function scan(): Finding[] {
  const found: Finding[] = [];

  for (const root of ROOTS) {
    for (const path of walk(join(ROOT, root))) {
      const rel = relative(ROOT, path);
      const lines = readFileSync(path, "utf8").split("\n");

      lines.forEach((line, i) => {
        // The escape hatch, and the line itself if somebody puts it there.
        if (line.includes("i18n-ignore")) return;
        if (i > 0 && lines[i - 1].includes("i18n-ignore")) return;
        const trimmed = line.trim();
        // Comments are for the next developer, not the reader of the screen.
        if (
          trimmed.startsWith("//") ||
          trimmed.startsWith("*") ||
          trimmed.startsWith("/*")
        )
          return;

        // A JSX text node: a line that is only words, sitting between tags.
        // `{t("…")}` and every other expression is skipped by construction.
        if (/^[A-Z][\w'’,. -]{2,}$/.test(trimmed) && !trimmed.endsWith(",")) {
          found.push({ file: rel, line: i + 1, text: trimmed });
        }
        // `>Some words<` on one line.
        for (const m of line.matchAll(/>([A-Z][\w'’,.?! -]{2,})</g)) {
          found.push({ file: rel, line: i + 1, text: m[1] });
        }
        // A spoken prop given a bare string.
        for (const prop of SPOKEN) {
          const re = new RegExp(`\\b${prop}=\\{?"([^"]{2,})"`, "g");
          for (const m of line.matchAll(re)) {
            // A key *is* the catalog. `title="account.title"` never happens, but
            // an icon name or a testid-shaped value would be a false positive.
            if (/^[a-z][a-zA-Z]*(\.[a-zA-Z]+)+$/.test(m[1])) continue;
            found.push({ file: rel, line: i + 1, text: `${prop}="${m[1]}"` });
          }
        }
        // A toast is text a person reads, and it is easy to leave behind because
        // it is not in the markup.
        for (const m of line.matchAll(/toast\.\w+\("([^"]{2,})"/g)) {
          found.push({ file: rel, line: i + 1, text: `toast("${m[1]}")` });
        }
      });
    }
  }
  return found;
}
