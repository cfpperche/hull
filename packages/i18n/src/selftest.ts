/**
 * The behaviour a catalog comparison cannot cover: negotiation and
 * interpolation.
 *
 * `node:assert`, not a test runner. There is no JavaScript unit-test framework
 * in this repo — the gates are pytest and Playwright — and importing one for two
 * pure functions costs more than it returns. This runs inside `check`, so CI
 * already has it. The day `packages/` grows enough logic to want a real runner,
 * this file is what moves.
 */
import assert from "node:assert/strict";
import { DEFAULT_LOCALE, best, negotiate } from "./locales";
import { createT, fill, holes, segments } from "./translate";

export function selftest(): number {
  let n = 0;
  const is = (actual: unknown, expected: unknown, what: string) => {
    n += 1;
    assert.deepEqual(actual, expected, what);
  };

  // --- negotiate: the header shape ---------------------------------------
  is(negotiate("pt-BR,pt;q=0.9,en;q=0.8"), "pt-BR", "exact match wins");
  is(negotiate("en-US,en;q=0.9"), "en", "en-US falls to en by base language");
  is(negotiate("pt-PT"), "pt-BR", "the only Portuguese we have beats English");
  is(negotiate("pt-br"), "pt-BR", "tags are case-insensitive");
  is(negotiate("de,fr;q=0.9"), DEFAULT_LOCALE, "nothing of ours: the default");
  is(negotiate("*"), DEFAULT_LOCALE, "a wildcard is the fallback, not a match");
  is(negotiate("pt-BR;q=0, en"), "en", "q=0 means refused, not preferred");
  is(negotiate(""), DEFAULT_LOCALE, "empty");
  is(negotiate(null), DEFAULT_LOCALE, "absent");

  // --- the exact-match pass ----------------------------------------------
  // Not expressible through `negotiate`: with one Portuguese in LOCALES the
  // near-match pass answers every case identically, so this is what proves the
  // exact pass exists at all.
  const PT = ["pt-PT", "pt-BR"] as const;
  is(best("pt-BR", PT, "pt-PT"), "pt-BR", "an exact match is taken");
  is(best("pt-BR,pt-PT;q=0.9", PT, "pt-PT"), "pt-BR", "even when a near match is listed first");
  is(best("pt-PT,pt-BR;q=0.9", PT, "pt-BR"), "pt-PT", "and the other way round");
  is(best("pt", PT, "pt-BR"), "pt-PT", "no exact match: the first available base match");
  is(best("de", PT, "pt-BR"), "pt-BR", "nothing: the fallback given");

  // --- negotiate: the navigator shape ------------------------------------
  is(negotiate(["pt-BR", "en"]), "pt-BR", "an array is accepted verbatim");
  is(negotiate(["de", "pt"]), "pt-BR", "and falls through it in order");

  // --- interpolation -----------------------------------------------------
  is(fill("Hello {name}", { name: "Ada" }), "Hello Ada", "a hole is filled");
  is(fill("{a} and {a}", { a: "x" }), "x and x", "every occurrence");
  is(fill("Expires in {n} minutes", { n: 30 }), "Expires in 30 minutes", "numbers");
  // Standing, not blanked: "Hello {name}" gets reported, "Hello " ships.
  is(fill("Hello {name}", {}), "Hello {name}", "an unfilled hole survives");
  is(fill("{{link}} stays", {}), "{{link}} stays", "the sender's holes are a different layer");
  is(holes("move {old} to {new}"), ["old", "new"], "holes are listed in order");

  is(segments("a {x} b"), ["a ", { hole: "x" }, " b"], "split at the hole");
  is(segments("{x}"), [{ hole: "x" }], "a hole on its own");
  is(segments("plain"), ["plain"], "no holes");
  is(segments(""), [], "empty");

  // --- the two catalogs actually differ ----------------------------------
  // A t() that returns English for every locale passes every other check here.
  const en = createT("en");
  const pt = createT("pt-BR");
  is(en("mail.verify.button"), "Confirm email", "English");
  is(pt("mail.verify.button"), "Confirmar e-mail", "Portuguese");
  assert.notEqual(en("mail.reset.title"), pt("mail.reset.title"), "the locales are not aliases");
  n += 1;

  // Holes survive translation, including reordered ones.
  is(
    pt("mail.changeConfirm.lead", { brand: "Hull", oldEmail: "a@b.test" }),
    "Confirme este endereço para que a Hull mova a@b.test para ele.",
    "filled in the translated word order",
  );

  return n;
}
