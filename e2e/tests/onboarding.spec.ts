import { expect, test } from "@playwright/test";
import { APP, createFirstOrg, newUser, signIn, signUp } from "./helpers";

test("signup lands in a named workspace", async ({ page }) => {
  const user = newUser("ob");
  await signUp(page, user);

  // A user with no membership is asked to name one before seeing the product.
  await expect(
    page.getByRole("heading", { name: "Name your workspace" }),
  ).toBeVisible();
  await createFirstOrg(page, "Acme");

  await expect(page.getByRole("heading", { name: "Acme" })).toBeVisible();
  await expect(page.getByTestId("org-switcher")).toContainText("Acme");
});

test("sign out and back in returns to the same workspace", async ({ page }) => {
  const user = newUser("ob");
  await signUp(page, user);
  await createFirstOrg(page, "Repeat");

  await page.getByTestId("user-menu").click();
  await page.getByTestId("sign-out").click();
  await expect(page.getByTestId("auth-submit")).toBeVisible();

  await signIn(page, APP, user.email, user.password);
  await expect(page.getByRole("heading", { name: "Repeat" })).toBeVisible();
});

test("signup refuses an email already taken, inline", async ({ page }) => {
  const user = newUser("ob");
  await signUp(page, user);
  await createFirstOrg(page, "First");

  await page.getByTestId("user-menu").click();
  await page.getByTestId("sign-out").click();

  const second = newUser("ob");
  await page.goto(`${APP}/signup`);
  await page.getByTestId("auth-username").fill(second.username);
  await page.getByTestId("auth-email").fill(user.email);
  await page.getByTestId("auth-password").fill(second.password);
  await page.getByTestId("auth-submit").click();

  // Inline on the form, not a toast — harness/action-feedback.md.
  await expect(page.getByText(/taken/i)).toBeVisible();
  await expect(page).toHaveURL(/\/signup$/);
});
