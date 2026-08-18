import { expect, test } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";
import {
  APP,
  HOST,
  createFirstOrg,
  expectTokenStripped,
  newUser,
  signUp,
} from "./helpers";

/**
 * Email verification, from the inbox.
 *
 * One test, covering the part only a browser shows: the banner a new account
 * carries, the link arriving in real mail, and the banner going away. Single
 * use, expiry, resend and the address-changed case are server properties and
 * live in tests/test_email_verification.py — cheaper there, and they do not
 * spend credential calls out of the suite's shared rate-limit budget.
 */
/**
 * The newest mail to this address that actually carries a verify link. Mailpit
 * ingests a moment after the API answers, so asking for "the newest mail" is a
 * race that reports a missing link which is merely late.
 */
async function verifyLink(
  request: APIRequestContext,
  address: string,
): Promise<string> {
  const wanted = /https:\/\/\S*\/verify#\S+/;
  for (let attempt = 0; attempt < 20; attempt++) {
    const list = await (
      await request.get(`https://mail.${HOST}/api/v1/messages?limit=50`)
    ).json();
    const mine = list.messages.filter((m: { To: { Address: string }[] }) =>
      m.To.some((t) => t.Address.toLowerCase() === address.toLowerCase()),
    );
    for (const m of mine) {
      const full = await (
        await request.get(`https://mail.${HOST}/api/v1/message/${m.ID}`)
      ).json();
      const found = wanted.exec(full.Text as string);
      if (found) return found[0];
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`no verify link mailed to ${address}`);
}

test("a new account is unverified until the emailed link is used", async ({
  page,
  playwright,
}) => {
  const user = newUser("emv");
  await signUp(page, user);
  await createFirstOrg(page, "Verified Co");

  const banner = page.getByTestId("verify-banner");
  await expect(banner).toContainText(user.email);

  const mail = await playwright.request.newContext({ ignoreHTTPSErrors: true });
  const link = await verifyLink(mail, user.email);

  await page.goto(link);
  await expectTokenStripped(page);
  await page.getByTestId("verify-continue").click();

  // The banner is the whole visible outcome — if it is still there, nothing the
  // API reported actually reached the chrome.
  await expect(page.getByTestId("verify-banner")).toBeHidden();

  await mail.dispose();
});
