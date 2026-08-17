import { expect, test } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";
import { APP, HOST, newUser, signIn, signUp } from "./helpers";

/**
 * Forgotten password.
 *
 * The only place the token exists is an inbox, so this spec reads Mailpit the
 * way a user reads their mail. That also puts the link's shape under test from
 * the outside: it has to be a fragment, because a query string would leave the
 * token in every access log between the mail client and the browser.
 *
 * Two tests, not five, on purpose. `/v1/auth/*` is rate-limited at the edge and
 * the whole suite shares one source IP, so every credential call spent here is
 * one the other specs do not get. What is left is what only a browser can show;
 * single use, expiry and the enumeration guard are server properties and live in
 * tests/test_password_reset.py, where they are cheap and deterministic.
 */
async function latestMailTo(request: APIRequestContext, address: string): Promise<string> {
  const list = await (await request.get(`https://mail.${HOST}/api/v1/messages?limit=50`)).json();
  const match = list.messages.find((m: { To: { Address: string }[] }) =>
    m.To.some((t) => t.Address.toLowerCase() === address.toLowerCase()),
  );
  expect(match, `no mail for ${address}`).toBeTruthy();
  const full = await (await request.get(`https://mail.${HOST}/api/v1/message/${match.ID}`)).json();
  return full.Text as string;
}

function resetLink(body: string): string {
  const found = /https:\/\/\S*\/reset#\S+/.exec(body);
  expect(found, `no reset link in:\n${body}`).toBeTruthy();
  return found![0];
}

test("a forgotten password can be reset from the emailed link", async ({ page, playwright }) => {
  const user = newUser("pwr");
  await signUp(page, user);
  await page.getByTestId("org-name").waitFor();
  await page.context().clearCookies();

  await page.goto(`${APP}/signin`);
  await page.getByTestId("auth-to-forgot").click();
  await page.getByTestId("forgot-email").fill(user.email);
  await page.getByTestId("forgot-submit").click();
  // The confirmation is the panel, not a banner over the form it just submitted.
  await expect(page.getByTestId("forgot-sent")).toBeVisible();

  const mail = await playwright.request.newContext({ ignoreHTTPSErrors: true });
  const link = resetLink(await latestMailTo(mail, user.email));

  await page.goto(link);
  // The token must not survive in the address bar: screenshots, bookmarks, history.
  expect(new URL(page.url()).hash).toBe("");

  // A typo is caught in the browser, so it costs neither a request nor the link.
  await page.getByTestId("reset-password").fill("brandnew123");
  await page.getByTestId("reset-confirm").fill("different999");
  await page.getByTestId("reset-submit").click();
  await expect(page.getByText(/different/i)).toBeVisible();
  await expect(page).toHaveURL(/\/reset$/);

  await page.getByTestId("reset-confirm").fill("brandnew123");
  await page.getByTestId("reset-submit").click();
  await expect(page).toHaveURL(/\/signin$/);

  // The new password works. The old one dying is asserted in pytest, where it
  // does not cost a sign-in attempt out of the shared budget.
  await signIn(page, APP, user.email, "brandnew123");
  await expect(page.getByTestId("org-name")).toBeVisible();

  await mail.dispose();
});

test("asking for a link says nothing about whether the account exists", async ({ page }) => {
  await page.goto(`${APP}/forgot`);
  await page.getByTestId("forgot-email").fill(`nobody-${Date.now()}@${HOST}`);
  await page.getByTestId("forgot-submit").click();
  // Same panel an existing address gets. A different one here would hand anyone
  // a membership oracle for any address they care to try.
  await expect(page.getByTestId("forgot-sent")).toBeVisible();
});
