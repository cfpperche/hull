import { expect, test } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";
import {
  APP,
  HOST,
  expectTokenStripped,
  newUser,
  signUpUnconfirmed,
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

test("an unconfirmed account cannot reach the product, on either side", async ({
  page,
  playwright,
}) => {
  const user = newUser("emv");
  await signUpUnconfirmed(page, user);

  // The wall, naming the address it is waiting on.
  await expect(page.getByTestId("confirm-wall")).toContainText(user.email);
  // And no way around it by asking for a route directly.
  await page.goto(`${APP}/account`);
  await expect(page.getByTestId("confirm-wall")).toBeVisible();

  // The half that means it. The screen is a courtesy; the cookie works fine from
  // outside the browser, so a wall that only exists in React is not a wall.
  const api = await page.request.post(`${APP}/api/v1/orgs`, {
    data: { name: "Should Not Exist" },
  });
  expect(api.status()).toBe(403);
  expect((await api.json()).message_key).toBe("error.emailUnverified");

  // Saying "I have confirmed it" before confirming anything has to say so
  // rather than quietly do nothing.
  await page.getByTestId("confirm-recheck").click();
  await expect(
    page.getByText("Not confirmed yet — open the link we sent."),
  ).toBeVisible();

  const mail = await playwright.request.newContext({ ignoreHTTPSErrors: true });
  const link = await verifyLink(mail, user.email);
  await page.goto(link);
  await expectTokenStripped(page);
  await page.getByTestId("verify-continue").click();

  // Through: the wall is gone and the first-run screen is what stands there now.
  await expect(page.getByTestId("confirm-wall")).toBeHidden();
  await expect(page.getByTestId("org-name")).toBeVisible();

  await mail.dispose();
});
