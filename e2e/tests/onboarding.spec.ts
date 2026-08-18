import { expect, test } from "@playwright/test";
import { APP, createFirstOrg, newUser, signIn, signUp } from "./helpers";

test("signup lands in a named workspace", async ({ page }) => {
  const user = newUser("ob");
  await signUp(page, user);

  // A user with no membership is asked for one before seeing the product.
  await expect(
    page.getByRole("heading", { name: "One more step" }),
  ).toBeVisible();
  await createFirstOrg(page, "Acme");

  await expect(page.getByRole("heading", { name: "Acme" })).toBeVisible();
  await expect(page.getByTestId("org-switcher")).toContainText("Acme");
});

/**
 * The half of signup that moved rather than disappeared.
 *
 * The form asks for an address and a password and nothing else, so the name has
 * to be collected somewhere — this is that somewhere, and it has to actually
 * save rather than merely render a box.
 */
test("the first-run screen collects the name signup stopped asking for", async ({
  page,
}) => {
  const user = newUser("ob");
  await signUp(page, user);

  await page.getByTestId("your-name").fill("Ada Lovelace");
  await createFirstOrg(page, "Analytical");

  // Through the door, and the name reached the account — the chrome reads it
  // from `me`, not from anything this page kept in memory.
  await expect(page.getByTestId("org-switcher")).toContainText("Analytical");
  await expect(page.getByTestId("user-menu")).toContainText("Ada Lovelace");

  // And it survives a reload, which is the difference between saved and shown.
  await page.reload();
  await expect(page.getByTestId("user-menu")).toContainText("Ada Lovelace");
});

test("the name is optional, the workspace is not", async ({ page }) => {
  const user = newUser("ob");
  await signUp(page, user);

  // Submitting with only the workspace works: with an email on every account
  // there is nothing here that account recovery depends on, so nothing else
  // earns the right to block the way in.
  await page.getByTestId("org-submit").click();
  await expect(page.getByText("Enter a workspace name.")).toBeVisible();

  await createFirstOrg(page, "Nameless");
  await expect(page.getByTestId("org-switcher")).toContainText("Nameless");
  // No name given, so the menu falls back to the address rather than showing an
  // empty label.
  await expect(page.getByTestId("user-menu")).toContainText(user.email);
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
  await page.getByTestId("auth-email").fill(user.email);
  await page.getByTestId("auth-password").fill(second.password);
  await page.getByTestId("auth-password-again").fill(second.password);
  await page.getByTestId("auth-submit").click();

  // Inline on the form, not a toast — harness/action-feedback.md.
  await expect(page.getByText(/taken/i)).toBeVisible();
  await expect(page).toHaveURL(/\/signup$/);
});
