/**
 * Render the templates once, at build time, into the Python adapter.
 *
 * React is not in the request path. `hull_fastapi` is what sends mail, and
 * putting Node behind SMTP would mean a second runtime in the compose group for
 * six transactional messages. So this renders each email to static HTML and
 * text with `{{name}}` holes in it, and the adapter fills the holes at send.
 *
 * **Once per locale.** A message goes out in the language of whoever receives
 * it, and there is no browser on that end to ask — so the language is chosen
 * here, at build, and the server's whole job is picking a file. That is what
 * keeps a second catalog, and an i18n library, out of Python. → ADR-0016
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
import { LOCALES, createT, type MessageKey, type T } from "@hull/i18n";
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

/**
 * The subject travels with the body.
 *
 * It used to be built in `Settings`, which put one half of every message in
 * Python and the other half here — and a subject that promises what the body no
 * longer says is exactly the drift nobody notices, because the two are only ever
 * read together in an inbox.
 */
type Email = { key: string; subject: MessageKey; render: (t: T) => ReactElement };

const EMAILS: Email[] = [
  { key: "welcome", subject: "mail.welcome.subject", render: (t) => <Welcome t={t} /> },
  { key: "welcome-verify", subject: "mail.welcome.subject", render: (t) => <WelcomeVerify t={t} /> },
  { key: "password-reset", subject: "mail.reset.subject", render: (t) => <PasswordReset t={t} /> },
  { key: "verify-email", subject: "mail.verify.subject", render: (t) => <VerifyEmail t={t} /> },
  {
    key: "email-change-confirm",
    subject: "mail.changeConfirm.subject",
    render: (t) => <EmailChangeConfirm t={t} />,
  },
  {
    key: "email-change-notice",
    subject: "mail.changeNotice.subject",
    render: (t) => <EmailChangeNotice t={t} />,
  },
  { key: "email-changed", subject: "mail.changed.subject", render: (t) => <EmailChanged t={t} /> },
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
function checkHoles(body: string): string[] {
  return holes(body).filter((name) => !KNOWN.has(name));
}

/**
 * A catalog hole that never got a value survives translation and lands in an
 * inbox as `{oldEmail}`. The i18n check proves the two locales agree with each
 * other; only this proves the JSX passes what the sentence actually asks for.
 */
function checkCatalogHoles(body: string): string[] {
  return [...body.matchAll(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g)]
    .map((m) => m[0])
    // `{{brand}}` matches the inner `{brand}` too — those are the sender's
    // holes, a different layer, and they are meant to survive.
    .filter((whole) => !body.includes(`{${whole}}`));
}

const check = process.argv.includes("--check");
const stale: string[] = [];
let bad = 0;

if (!check && !existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const want = new Set<string>();

for (const locale of LOCALES) {
  const t = createT(locale);
  for (const email of EMAILS) {
    const element = email.render(t);
    const html = await render(element);
    // Visible text only, which is why every link email prints its URL in the
    // body rather than hiding it behind a button: this is the half a text-only
    // client shows, and it has to carry a usable link.
    const text = await render(element, { plainText: true, htmlToTextOptions: TEXT });
    const subject = t(email.subject, { brand: V.brand });

    for (const [suffix, body] of [
      ["html", html],
      ["txt", text],
      ["subject", subject],
    ] as const) {
      const name = `${email.key}.${locale}.${suffix}`;
      want.add(name);

      const unknown = checkHoles(body);
      if (unknown.length) {
        console.error(`✗ ${name}: unknown placeholder(s) ${unknown.join(", ")}`);
        bad += unknown.length;
        continue;
      }
      const unfilled = checkCatalogHoles(body);
      if (unfilled.length) {
        console.error(`✗ ${name}: catalog hole(s) never given a value: ${unfilled.join(", ")}`);
        bad += unfilled.length;
        continue;
      }

      const path = join(OUT, name);
      const current = existsSync(path) ? readFileSync(path, "utf8") : null;
      if (current === body) continue;
      if (check) stale.push(name);
      else writeFileSync(path, body);
    }
  }
}

// A template deleted from the JSX, or a locale dropped from LOCALES, must not
// linger in the adapter still being sent by a loader that has no idea it is an
// orphan. Fails the check rather than warning: with a locale in the filename
// this is now how a removed language leaves the build.
const orphans = readdirSync(OUT).filter(
  (name) => /\.(html|txt|subject)$/.test(name) && !want.has(name),
);
if (orphans.length) {
  if (check) {
    console.error(`✗ orphans in ${OUT}: ${orphans.join(", ")}`);
    bad += orphans.length;
  } else {
    for (const name of orphans) console.error(`✗ orphan in ${OUT}: ${name} — delete it`);
  }
}

if (bad) {
  console.error(`\n${bad} problem(s). Declare holes in src/vars.ts, or rerun the build.`);
  process.exit(1);
}
if (check && stale.length) {
  console.error(`✗ generated templates are out of date: ${stale.join(", ")}`);
  console.error("  run: pnpm --filter @hull/email build");
  process.exit(1);
}
console.log(
  check
    ? `EMAIL_CHECK_OK ${EMAILS.length} templates × ${LOCALES.length} locales`
    : `EMAIL_BUILD_OK ${EMAILS.length} × ${LOCALES.length} -> ${OUT}`,
);
