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

  await createFirstOrg(page, "Analytical", "Ada Lovelace");

  // Through the door, and the name reached the account — the chrome reads it
  // from `me`, not from anything this page kept in memory.
  await expect(page.getByTestId("org-switcher")).toContainText("Analytical");
  await expect(page.getByTestId("user-menu")).toContainText("Ada Lovelace");

  // And it survives a reload, which is the difference between saved and shown.
  await page.reload();
  await expect(page.getByTestId("user-menu")).toContainText("Ada Lovelace");
});

test("neither field lets you past empty", async ({ page }) => {
  const user = newUser("ob");
  await signUp(page, user);
  const submit = page.getByTestId("org-submit");

  await expect(submit).toBeDisabled();

  // One at a time, so the assertion is about each field rather than about the
  // pair. A rule that only checked the workspace would pass a test that filled
  // both and then emptied neither.
  await page.getByTestId("your-name").fill("Carlos");
  await expect(submit).toBeDisabled();
  await page.getByTestId("your-name").fill("");
  await page.getByTestId("org-name").fill("Nameless");
  await expect(submit).toBeDisabled();

  await page.getByTestId("your-name").fill("Carlos");
  await expect(submit).toBeEnabled();
  await submit.click();

  await expect(page.getByTestId("org-switcher")).toContainText("Nameless");
  await expect(page.getByTestId("user-menu")).toContainText("Carlos");
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

/**
 * Kept in step with MATCH_DELAY_MS in packages/ui/src/lib/use-password-match.ts.
 * Not imported: e2e does not depend on the component kit, and a spec that waits
 * an arbitrary amount is one that goes flaky the day the real number moves — so
 * if this drifts, the halves below start failing rather than passing quietly.
 */
const MATCH_DELAY_MS = 500;

test("the repeat field waits for a pause before calling you wrong", async ({
  page,
}) => {
  const user = newUser("ob");
  await page.goto(`${APP}/signup`);
  await page.getByTestId("auth-email").fill(user.email);
  await page.getByTestId("auth-password").fill("demodemo1");

  // Typed one character at a time, which is the case the debounce exists for:
  // the second box differs from the first from its very first keystroke, and a
  // naive comparison calls the person wrong while they are still answering.
  await page
    .getByTestId("auth-password-again")
    .pressSequentially("demo", { delay: 30 });
  await expect(page.getByTestId("auth-password-mismatch")).toBeHidden();

  // And then it does appear — without this half, the assertion above would pass
  // against an element that never exists at all.
  await expect(page.getByTestId("auth-password-mismatch")).toBeVisible({
    timeout: MATCH_DELAY_MS * 4,
  });

  // Withdrawing the complaint is not debounced. A timeout shorter than the wait
  // is the assertion: if the retraction were delayed like the complaint, this
  // fails.
  await page.getByTestId("auth-password-again").fill("demodemo1");
  await expect(page.getByTestId("auth-password-mismatch")).toBeHidden({
    timeout: MATCH_DELAY_MS - 200,
  });

  // Break it a second time. The message must wait again rather than snap back
  // from the state it was left in — `setShown(false)` on the way out is what
  // buys that, and without it the second mistake is announced instantly while
  // the first one was not.
  await page
    .getByTestId("auth-password-again")
    .pressSequentially("x", { delay: 30 });
  await expect(page.getByTestId("auth-password-mismatch")).toBeHidden();
  await expect(page.getByTestId("auth-password-mismatch")).toBeVisible({
    timeout: MATCH_DELAY_MS * 4,
  });

  await page.getByTestId("auth-password-again").fill("demodemo1");
  await page.getByTestId("auth-submit").click();
  await page.getByTestId("org-name").waitFor();
});

test("the button is dead only while a reason is on screen", async ({
  page,
}) => {
  const user = newUser("ob");
  await page.goto(`${APP}/signup`);
  const submit = page.getByTestId("auth-submit");

  // Empty form: dead, and every field is visibly blank — the explanation is the
  // form itself.
  await expect(submit).toBeDisabled();

  await page.getByTestId("auth-email").fill(user.email);
  await page.getByTestId("auth-password").fill("demodemo1");
  await expect(submit).toBeDisabled();

  // Filled but mismatched. Live at first — the mismatch is true before it is
  // said, and a button that dies during that window is a dead control with
  // nothing on screen to explain it.
  await page.getByTestId("auth-password-again").fill("demodemo2");
  await expect(submit).toBeEnabled();

  // Once the reason appears, the button goes with it.
  await expect(page.getByTestId("auth-password-mismatch")).toBeVisible({
    timeout: MATCH_DELAY_MS * 4,
  });
  await expect(submit).toBeDisabled();

  // And comes back. Without this half the whole test passes on a button that is
  // simply always disabled.
  await page.getByTestId("auth-password-again").fill("demodemo1");
  await expect(submit).toBeEnabled();
  await submit.click();
  await page.getByTestId("org-name").waitFor();
});

test("submitting inside the pause is still refused", async ({ page }) => {
  const user = newUser("ob");
  await page.goto(`${APP}/signup`);
  await page.getByTestId("auth-email").fill(user.email);
  await page.getByTestId("auth-password").fill("demodemo1");
  await page.getByTestId("auth-password-again").fill("demodemo2");
  // No wait: the button is pressed while the message is still holding its
  // tongue. The guard reads the truth, not the debounced text.
  await page.getByTestId("auth-submit").click();

  await expect(page.getByTestId("auth-password-mismatch")).toBeVisible();
  await expect(page).toHaveURL(/\/signup$/);
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
