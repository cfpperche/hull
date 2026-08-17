import { expect, test } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";
import {
  APP,
  HOST,
  LAB_PASSWORD,
  createFirstOrg,
  expectTokenStripped,
  newUser,
  signUp,
} from "./helpers";

/**
 * Changing the address you sign in with, from the inbox.
 *
 * One test, covering only what a browser shows: the form on the account page,
 * the link arriving in the *new* mailbox, and the account still answering to the
 * old address until that link is used. Single use, expiry, collisions, the
 * password gate and the cancel-on-password-change are server properties and live
 * in tests/test_email_change.py — cheaper there, and they do not spend
 * credential calls out of the suite's shared rate-limit budget.
 */

/**
 * The newest mail to this address that actually carries a change link. Mailpit
 * ingests a moment after the API answers, so taking "the newest mail" is a race
 * that reports a missing link which is merely late.
 */
async function changeLink(request: APIRequestContext, address: string): Promise<string> {
  const wanted = /https:\/\/\S*\/email#\S+/;
  for (let attempt = 0; attempt < 20; attempt++) {
    const list = await (await request.get(`https://mail.${HOST}/api/v1/messages?limit=50`)).json();
    const mine = list.messages.filter((m: { To: { Address: string }[] }) =>
      m.To.some((t) => t.Address.toLowerCase() === address.toLowerCase()),
    );
    for (const m of mine) {
      const full = await (await request.get(`https://mail.${HOST}/api/v1/message/${m.ID}`)).json();
      const found = wanted.exec(full.Text as string);
      if (found) return found[0];
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`no change link mailed to ${address}`);
}

test("the address moves only once the new mailbox confirms it", async ({ page, playwright }) => {
  const user = newUser("chg");
  // Deliberately not derived from the old address. A `moved-${user.username}`
  // form *contains* the old one, so a substring text match reported the right
  // answer for either — the version of this test that did that passed with the
  // change wrongly applied at request time.
  const moved = newUser("mvd").email;
  await signUp(page, user);
  await createFirstOrg(page, "Moving Co");

  await page.goto(`${APP}/account`);
  await page.getByTestId("email-new").fill(moved);
  await page.getByTestId("email-password").fill(LAB_PASSWORD);
  await page.getByTestId("email-submit").click();

  // The page must say the change is pending, not that it happened — this is the
  // sentence that stops someone assuming their old address stopped working.
  await expect(page.getByTestId("email-sent")).toContainText(moved);
  await expect(page.getByTestId("email-sent")).toContainText(user.email);

  const mail = await playwright.request.newContext({ ignoreHTTPSErrors: true });
  const link = await changeLink(mail, moved);

  // Still the old address, with the link sitting unread. Reloading is the point:
  // a client that had optimistically shown the new one would be caught here.
  await page.reload();
  await expect(page.getByTestId("account-email")).toHaveText(user.email);

  await page.goto(link);
  await expectTokenStripped(page);
  await page.getByTestId("email-change-continue").click();

  // The new address is what the chrome shows, and the verify banner is gone —
  // redeeming this link is the same proof the confirmation link asks for.
  await page.goto(`${APP}/account`);
  await expect(page.getByTestId("account-email")).toHaveText(moved);
  await expect(page.getByTestId("verify-banner")).toBeHidden();

  await mail.dispose();
});
