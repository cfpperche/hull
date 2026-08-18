import { expect, test } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";
import { APP, HOST, createFirstOrg, newUser, signIn, signUp } from "./helpers";

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
test("the language follows the account, not the browser", async ({
  page,
  browser,
}) => {
  const user = newUser("lang");
  await signUp(page, user);
  await createFirstOrg(page, "Idiomas Ltda");

  await page.goto(`${APP}/account`);
  // The suite is pinned to en-US, so this is the negotiated answer rather than
  // a coincidence of the machine it runs on.
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  // `exact` because "Close account" is also a heading on this page.
  await expect(page.getByRole("heading", { name: "Account", exact: true })).toBeVisible();

  await page.getByTestId("locale-pt-BR").click();
  await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
  // The screens move with it. Found by role and name rather than by testid,
  // because the words are the thing under test here.
  await expect(page.getByRole("heading", { name: "Conta", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Account", exact: true })).toHaveCount(0);
  // Not just a class on the button: the account was actually written to, so a
  // reload with no client state left has to come back in Portuguese.
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
  await expect(page.getByTestId("locale-pt-BR")).toHaveAttribute(
    "aria-checked",
    "true",
  );

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
  await expect(
    other.getByRole("heading", { name: "Onde você está conectado" }),
  ).toBeVisible();
  await second.close();

  // And back, so the account is left as it was found.
  await page.getByTestId("locale-en").click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

/** The newest mail to this address, once one has arrived. Mailpit ingests a
 *  moment after the API answers, so a single read is a race. */
async function mailFor(request: APIRequestContext, address: string) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const list = await (
      await request.get(`https://mail.${HOST}/api/v1/messages?limit=50`)
    ).json();
    const mine = list.messages.find((m: { To: { Address: string }[] }) =>
      m.To.some((t) => t.Address.toLowerCase() === address.toLowerCase()),
    );
    if (mine) {
      const full = await (
        await request.get(`https://mail.${HOST}/api/v1/message/${mine.ID}`)
      ).json();
      return {
        subject: mine.Subject as string,
        text: full.Text as string,
        html: full.HTML as string,
      };
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`no mail arrived for ${address}`);
}

/**
 * The end of the chain, and the reason the mail was done before the screens.
 *
 * A real browser set to Portuguese, a real signup, and the message read out of
 * the lab inbox the way a person would. Nothing here can pass on a mocked
 * locale: the header is the browser's, the account row is the server's, the
 * template was chosen at build time, and the delivery is SMTP.
 */
test("a Portuguese browser is welcomed in Portuguese", async ({
  browser,
  playwright,
}) => {
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    locale: "pt-BR",
  });
  const page = await context.newPage();
  const user = newUser("mail");
  await signUp(page, user);
  await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
  // Straight off the header, with no account choice made yet: the signup screen
  // hands this browser a Portuguese workspace prompt.
  await expect(
    page.getByRole("heading", { name: "Dê um nome ao seu espaço de trabalho" }),
  ).toBeVisible();

  const request = await playwright.request.newContext({
    ignoreHTTPSErrors: true,
  });
  const mail = await mailFor(request, user.email);

  expect(mail.subject).toContain("Bem-vindo");
  expect(mail.text).toContain("Sua conta está pronta");
  // Disjoint from the Portuguese, deliberately: "Confirme" contains "Confirm",
  // and an assertion that passes in either language proves nothing.
  expect(mail.text).not.toContain("Your account is ready");
  // The document language travels with the message — a screen reader picks its
  // voice from this, and there is no browser on the receiving end to correct it.
  expect(mail.html).toContain('lang="pt-BR"');
  // Nothing shipped a hole. This is the failure that reaches an inbox looking
  // like a defect rather than like a bug.
  expect(mail.text).not.toContain("{{");
  expect(mail.html).not.toContain("{{");

  await request.dispose();
  await context.close();
});
