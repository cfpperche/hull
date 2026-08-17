/**
 * Render the templates once, at build time, into the Python adapter.
 *
 * React is not in the request path. `hull_fastapi` is what sends mail, and
 * putting Node behind SMTP would mean a second runtime in the compose group for
 * six transactional messages. So this renders each email to static HTML and
 * text with `{{name}}` holes in it, and the adapter fills the holes at send.
 *
 * The output lands inside `adapters/fastapi/src/` rather than a `dist/` here for
 * two reasons that are both about the image: the API build context is the
 * adapter directory alone, and `.dockerignore` excludes every `dist/`. As
 * package data it needs no path setting, no volume and no Dockerfile change.
 * The JSX is the source; that directory is a generated artifact, and
 * `pnpm --filter @hull/email check` fails if it has drifted.
 *
 *   pnpm --filter @hull/email build     write
 *   pnpm --filter @hull/email check     verify, without writing (CI)
 *   pnpm --filter @hull/email dev       preview at :3300
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { plainTextSelectors, render } from "@react-email/render";
import type { ReactElement } from "react";
import { V } from "./vars";

import EmailChangeConfirm from "./emails/email-change-confirm";
import EmailChangeNotice from "./emails/email-change-notice";
import EmailChanged from "./emails/email-changed";
import PasswordReset from "./emails/password-reset";
import VerifyEmail from "./emails/verify-email";
import Welcome from "./emails/welcome";
import WelcomeVerify from "./emails/welcome-verify";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "../../../adapters/fastapi/src/hull_fastapi/mail_templates");

const EMAILS: Array<[string, ReactElement]> = [
  ["welcome", <Welcome />],
  ["welcome-verify", <WelcomeVerify />],
  ["password-reset", <PasswordReset />],
  ["verify-email", <VerifyEmail />],
  ["email-change-confirm", <EmailChangeConfirm />],
  ["email-change-notice", <EmailChangeNotice />],
  ["email-changed", <EmailChanged />],
];

/**
 * How the HTML becomes the plain-text half.
 *
 * Defaults first, then three corrections. The converter shouts headings in caps,
 * which reads as anger rather than emphasis in a security mail; the brand mark
 * and the buttons are marked as decoration in Layout.tsx because both would
 * otherwise duplicate something already on the line below.
 */
const TEXT = {
  selectors: [
    ...plainTextSelectors,
    { selector: "h1", options: { uppercase: false } },
    { selector: '[data-plain-text="skip"]', format: "skip" },
  ],
};

/** Every hole `vars.ts` declares. Anything else in the output is a typo. */
const KNOWN = new Set(Object.values(V).map((v) => v.slice(2, -2)));

function holes(body: string): string[] {
  return [...body.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/g)].map((m) => m[1]);
}

/**
 * A mistyped placeholder is the failure this catches. `{{lnk}}` renders to
 * nothing the adapter knows, so it survives substitution and is delivered
 * literally — a password-reset mail with `{{lnk}}` where the URL should be.
 * Cheaper to fail the build than to read it in an inbox.
 */
function checkHoles(key: string, body: string): string[] {
  return holes(body).filter((name) => !KNOWN.has(name));
}

const check = process.argv.includes("--check");
const stale: string[] = [];
let unknown = 0;

if (!check && !existsSync(OUT)) mkdirSync(OUT, { recursive: true });

for (const [key, element] of EMAILS) {
  const html = await render(element);
  // Visible text only, which is why every link email prints its URL in the body
  // rather than hiding it behind a button: this is the half a text-only client
  // shows, and it has to carry a usable link.
  const text = await render(element, { plainText: true, htmlToTextOptions: TEXT });

  for (const [suffix, body] of [
    ["html", html],
    ["txt", text],
  ] as const) {
    const bad = checkHoles(key, body);
    if (bad.length) {
      console.error(`✗ ${key}.${suffix}: unknown placeholder(s) ${bad.join(", ")}`);
      unknown += bad.length;
      continue;
    }
    const path = join(OUT, `${key}.${suffix}`);
    const current = existsSync(path) ? readFileSync(path, "utf8") : null;
    if (current === body) continue;
    if (check) stale.push(`${key}.${suffix}`);
    else writeFileSync(path, body);
  }
}

if (!check) {
  // A template deleted from the JSX must not linger in the adapter, still being
  // sent by a loader that has no idea it is an orphan.
  const want = new Set(EMAILS.flatMap(([key]) => [`${key}.html`, `${key}.txt`]));
  for (const name of readdirSync(OUT)) {
    if (name.endsWith(".html") || name.endsWith(".txt")) {
      if (!want.has(name)) console.error(`✗ orphan in ${OUT}: ${name} — delete it`);
    }
  }
}

if (unknown) {
  console.error(`\n${unknown} unknown placeholder(s). Declare them in src/vars.ts.`);
  process.exit(1);
}
if (check && stale.length) {
  console.error(`✗ generated templates are out of date: ${stale.join(", ")}`);
  console.error("  run: pnpm --filter @hull/email build");
  process.exit(1);
}
console.log(check ? `EMAIL_CHECK_OK ${EMAILS.length} templates` : `EMAIL_BUILD_OK -> ${OUT}`);
