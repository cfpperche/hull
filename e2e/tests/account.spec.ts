import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { APP, createFirstOrg, newUser, signInExpectingFailure, signUp } from "./helpers";

const AVATAR = fileURLToPath(new URL("../fixtures/avatar.png", import.meta.url));

test.beforeEach(async ({ page }) => {
  const user = newUser("ac");
  await signUp(page, user);
  await createFirstOrg(page, "Account");
  // Carry the identity into the test body.
  await page.evaluate((e) => sessionStorage.setItem("e2e-email", e), user.email);
  await page.goto(`${APP}/account`);
});

/**
 * The reason this suite exists. Avatar upload never worked: the shared client
 * stamped Content-Type: application/json onto a FormData body, killing the
 * multipart boundary. The API was correct and every API test passed.
 */
test("uploading a photo works and the chrome shows it", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Account", exact: true })).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles(AVATAR);

  await expect(page.getByText("Photo updated")).toBeVisible();
  const avatar = page.getByTestId("user-menu").locator("img");
  await expect(avatar).toBeVisible();

  // The bytes have to actually come back, not just an <img> that 404s.
  const res = await page.request.get(`${APP}/api/v1/me/avatar`);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("image/webp");
});

test("saving the profile confirms, and clearing a name clears it", async ({ page }) => {
  await page.getByTestId("profile-name").fill("Ada Lovelace");
  await page.getByTestId("profile-save").click();
  await expect(page.getByText("Profile saved")).toBeVisible();
  await expect(page.getByTestId("user-menu")).toContainText("Ada Lovelace");

  // A cleared field used to be discarded while the toast still said "saved".
  await page.getByTestId("profile-name").fill("");
  await page.getByTestId("profile-save").click();
  await expect(page.getByText("Profile saved")).toBeVisible();

  await page.reload();
  await expect(page.getByTestId("profile-name")).toHaveValue("");
});

test("changing the password keeps this session and invalidates the old one", async ({ page }) => {
  const email = await page.evaluate(() => sessionStorage.getItem("e2e-email"));
  await page.getByLabel("Current").fill("demodemo1");
  await page.getByLabel("New").fill("demodemo2");
  await page.getByRole("button", { name: /Update password/ }).click();
  await expect(page.getByText("Password updated")).toBeVisible();

  // Still signed in on the rotated cookie.
  await page.goto(`${APP}/`);
  await expect(page.getByTestId("org-switcher")).toBeVisible();

  await page.getByTestId("user-menu").click();
  await page.getByTestId("sign-out").click();
  await signInExpectingFailure(page, APP, email!, "demodemo1");
  await expect(page.getByText(/invalid email or password/i)).toBeVisible();
});

test("closing an account asks first", async ({ page }) => {
  await page.getByTestId("close-password").fill("demodemo1");
  await page.getByTestId("close-account").click();

  // Destructive takes a dialog before, never after — harness/action-feedback.md.
  const dialog = page.getByTestId("close-account-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(/cannot be undone/i);

  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("heading", { name: "Account", exact: true })).toBeVisible();
});
