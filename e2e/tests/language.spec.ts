import { expect, test } from "@playwright/test";
import { APP, createFirstOrg, newUser, signIn, signUp } from "./helpers";

/**
 * Which language the account reads.
 *
 * Only a browser proves the two halves that matter here: that the choice is
 * carried by the account rather than by the browser it was made in, and that
 * `<html lang>` follows — the attribute nothing on the server can set, because
 * there is one build and it is served to every reader.
 *
 * The screens are still in English at this point. That is deliberate: the
 * ladder, the column and the document language are one delivery, the 132
 * strings are the next one, and proving the first before starting the second is
 * the whole reason they are separate. Negotiation itself is asserted on both
 * sides in `packages/i18n/src/selftest.ts` and `tests/test_locale.py`.
 */
test("the language follows the account, not the browser", async ({ page, browser }) => {
  const user = newUser("lang");
  await signUp(page, user);
  await createFirstOrg(page, "Idiomas Ltda");

  await page.goto(`${APP}/account`);
  // A browser with no stated preference: English, and the document says so.
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  await page.getByTestId("locale-pt-BR").click();
  await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
  // Not just a class on the button: the account was actually written to, so a
  // reload with no client state left has to come back in Portuguese.
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
  await expect(page.getByTestId("locale-pt-BR")).toHaveAttribute("aria-checked", "true");

  // The one thing already localised before any string moved: the session list
  // formats "last used" through Intl, and it now takes the account's language
  // rather than the browser's. English text beside a Portuguese date is the
  // half-translated sentence this work exists to remove — here the date has to
  // move with the account.
  const second = await browser.newContext({ ignoreHTTPSErrors: true });
  const other = await second.newPage();
  await signIn(other, APP, user.email, user.password);
  await other.goto(`${APP}/account`);
  // A different browser entirely, carrying no choice of its own. The stored one
  // still wins.
  await expect(other.locator("html")).toHaveAttribute("lang", "pt-BR");
  await second.close();

  // And back, so the account is left as it was found.
  await page.getByTestId("locale-en").click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});
