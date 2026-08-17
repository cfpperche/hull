import { expect, test } from "@playwright/test";
import { APP, LAB_PASSWORD, createFirstOrg, newUser, signIn, signUp } from "./helpers";

/**
 * Seeing where you are signed in, and ending it.
 *
 * One test, covering what only a browser proves: a second real browser context
 * is a second real session, the list names the one you are reading it from, and
 * ending the other one actually locks that context out. Ownership, 404s, expiry
 * and the last_seen write budget are server properties and live in
 * tests/test_sessions.py.
 */
test("a second browser shows up in the list, and ending it locks that browser out", async ({
  page,
  browser,
}) => {
  const user = newUser("ses");
  await signUp(page, user);
  await createFirstOrg(page, "Two Devices Co");

  await page.goto(`${APP}/account`);
  // Alone, and marked as the one being read from.
  await expect(page.getByTestId("session-row")).toHaveCount(1);
  await expect(page.getByTestId("session-row").first()).toContainText("This device");
  // Nothing to sign out of yet, so the bulk control must not be offered.
  await expect(page.getByTestId("session-revoke-others")).toBeHidden();

  // A genuinely separate browser context: its own cookie jar, its own session
  // row. Two tabs would share one, and would prove nothing.
  const second = await browser.newContext({ ignoreHTTPSErrors: true });
  const other = await second.newPage();
  await signIn(other, APP, user.email, user.password);
  await expect(other.getByTestId("user-menu")).toBeVisible();

  await page.reload();
  await expect(page.getByTestId("session-row")).toHaveCount(2);
  await expect(page.getByTestId("session-revoke-others")).toBeVisible();

  // Exactly one row is this device — and it is the one with no End button.
  await expect(page.getByTestId("session-row").filter({ hasText: "This device" })).toHaveCount(1);
  await expect(page.getByTestId("session-revoke")).toHaveCount(1);

  await page.getByTestId("session-revoke").click();
  await expect(page.getByText("Session ended")).toBeVisible();
  await expect(page.getByTestId("session-row")).toHaveCount(1);

  // The other browser is out, not merely missing from a list. Reloading it lands
  // on sign-in, which is the only proof that matters here.
  await other.reload();
  await expect(other.getByTestId("auth-submit")).toBeVisible();

  await second.close();
});
