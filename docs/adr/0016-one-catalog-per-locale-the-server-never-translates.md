# 0016. One catalog per locale, and the server never translates

**Status:** Accepted  
**Date:** 2026-08-17

## Context

Hull speaks English and does not know that it does. `lang="en"` is hard-coded in
the three `index.html` files and in the email layout, there is no locale column
on `users` or `orgs`, and 132 strings across 33 files are typed directly into the
markup that renders them.

It is not, however, monolingual. `SessionList.tsx` formats "last used" with
`new Intl.RelativeTimeFormat(undefined, …)`, and `undefined` means *the viewer's
browser*. A Brazilian reader is already served **"Last used há 4 minutos"** — half
a sentence in each language, on a screen shipped this month. That is the whole
problem in one line: the dates localise because a platform API defaulted them,
the words never do, and nothing in the system can be asked which language this
person reads.

So the question is not "translate the product". It is **where the answer to
*which language?* lives**, because right now every piece of the system answers it
separately, or not at all.

Three properties of this repo constrain the answer.

**Mail is rendered outside the request.** `packages/email` renders react-email JSX
to static HTML and text at build time, and `hull_fastapi` fills `{{holes}}` at
send. That was decided so a second runtime would not sit behind SMTP for six
transactional messages. Whatever i18n does must not put Node — or a translation
library — back into the send path.

**Mail goes to a recipient, not to a caller.** When a support operator changes
something and the notice goes to the customer, the customer's language is the one
that matters. There is no browser on the receiving end to ask.

**The error strings are on the server.** Seventeen distinct messages, and the
client renders `problem.detail` verbatim. The six existing `reason_code` values
are far too coarse to key them: `unauthenticated` alone covers *invalid email or
password*, *password is wrong*, *current password is wrong*, and three separate
expired-link messages.

The obvious shape — a catalog in the frontend and a second one in Python — solves
all three and is wrong. Two lists of the same sentences, maintained by hand,
diverge in weeks, and the divergence is invisible until a customer reads it.

## Decision

**One catalog per locale, in `packages/i18n`, with three consumers.**

`en.ts` and `pt-BR.ts` are the only places a sentence exists. Three different
things read them, at three different times:

| Consumer | When it reads | How |
|---|---|---|
| The screens | In the browser, at render | `t("auth.signIn")` |
| The emails | At build, in `packages/email` | rendered per locale into the adapter |
| The API errors | In the browser, at render | server sends a code, client looks it up |

**The server never translates a string.** It selects a file. `mail_compose` gains
a locale argument and reads `password-reset.pt-BR.html` instead of
`password-reset.html`; that is the entire server-side change. No gettext, no
Babel, no catalog in Python, no third runtime. The work of translating happens
before the process starts, which is the same reason mail is rendered at build
time in the first place.

**No i18n library.** What is actually needed is key lookup and interpolation,
which is about sixty lines. Nothing in the product has a variable count today, so
no plural machinery is built; when a count arrives, `Intl.PluralRules` is in the
platform and the wrapper is written then. `react-i18next` and its neighbours are
bought for their ecosystems — extraction, linting, translation-management
integration — and with two locales and 132 strings a text file beats all of it.

What the ecosystem *would* have given us is the missing-key warning, and that is
replaced by a build gate rather than dropped: `pnpm --filter @hull/i18n check`
fails when one locale has a key the other does not. Same mechanism, same shape,
same reason as `pnpm --filter @hull/email check`. A screen half in Portuguese
looks like a defect, so an incomplete locale must not compile.

**A key names a whole phrase, never a fragment.** `sessions.lastUsed` is
`"Last used {ago}"` and `"Usado {ago}"`, not `"Last used"` concatenated with a
date. English tolerates gluing words to values and Portuguese does not — the "há"
belongs to the date there, not to the sentence. Fragment keys are how a catalog
becomes untranslatable one convenience at a time.

**The ladder, in order, first answer wins:**

1. The person's stored choice — `users.locale`, set on the Account page.
2. `Accept-Language` on the server, `navigator.languages` in the browser.
3. `en`.

`users.locale` is populated at signup from `Accept-Language`, the same way
`user_agent` is already captured on session insert. This is what makes rung 1
answerable for mail, where there is no browser to ask.

**Mail resolves the recipient's locale, not the caller's.** Every one of the six
send sites has a user row in hand — including `forgot`, which only sends when the
address resolves — so the recipient's stored locale is always available.

**No locale on the org.** Speculation until a customer asks to standardise a
multilingual team, and the ladder above has no rung it would fit into without an
argument about which wins.

**Two locales: `en` and `pt-BR`.** One proves nothing — a catalog with a single
locale cannot fail the completeness check, and a `t()` that is never given a
second answer is a lookup table pretending to be i18n. Three multiply the review
burden with no new information.

## Consequences

**The contract gains a message code.** `reason_code` stays what it is — the
coarse class the client branches on — and a new field carries the specific
message key. `detail` continues to be sent in English, as the log line and as the
fallback for a client that has not been updated. This is a `contracts/openapi.yaml`
change, which is why it is sequenced last: the contract is the expensive thing to
change twice.

**The browser tests are pinned to `en`.** Several `e2e/` specs find a control by
the words written on it. Once the words move, the honest options are to pin the
run's locale or to pin the specs to test IDs, and both are needed: the run is
fixed to `en`, and any spec whose subject *is* the string uses `data-testid`.
Loosening an assertion until it passes is how this repo has previously shipped
tests that verified nothing — twice — and translation is a rich opportunity to do
it a third time.

**The generated mail tree grows by a factor of the locale count.** Seven
templates × two formats × two locales is 28 files under
`hull_fastapi/mail_templates/`. They stay generated, still must not be
hand-edited, and the check still fails on drift. The `--check` and orphan passes
already handle the matrix; they iterate a list either way.

**`users.locale` ships with a default.** `hull_test` is never dropped and keeps
rows between runs, so a `NOT NULL` column without one turns every pre-existing
account into a migration failure that only shows up locally.

**`Intl` calls stop defaulting.** Every formatter takes the resolved locale
explicitly. The `undefined` in `SessionList.tsx` is the bug this ADR opened with,
and leaving even one of them is leaving the door open for the same half-translated
sentence to come back.

**Right-to-left is not supported, and must not be prevented.** No RTL locale is
shipping, so no bidi work is done. The standing cost is one habit: reach for
Tailwind's logical utilities (`ms-`, `me-`, `text-start`) over `ml-`, `mr-`,
`text-left` in new work, so the day an Arabic or Hebrew locale is sold the layout
is a stylesheet problem rather than a rewrite.

**Locale is not in the URL.** The product is behind a login and reads the account;
the marketing site has no SEO requirement yet. The day `apps/www` needs Google to
index Portuguese, that is a routing decision for that surface alone, and it
supersedes this paragraph rather than the whole ADR.

**Time zones, currency and a translation platform are all out.** Time zone is a
different axis wearing the same coat; there is no money in the product to format;
and a translation-management tool is bought when translators are not the team.
Each has a trigger, none has one now.
