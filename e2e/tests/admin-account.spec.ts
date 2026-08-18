import { expect, test } from "@playwright/test";
import { ADMIN, HOST, LAB_PASSWORD, signIn } from "./helpers";

/**
 * The console's own account page.
 *
 * It exists because the product's is out of reach: a platform admin who is not
 * impersonating gets bounced from `app.` straight back here. So this is the only
 * place an operator can change their own password or address, and the only place
 * they can see the sessions they take into customers' workspaces.
 *
 * One test, covering what only a browser shows: that the page is reachable at
 * all, that it does not offer the one action the server refuses, and that
 * editing the profile reaches the chrome.
 */
test("an operator can reach their own account, and is not offered a close button", async ({
  page,
}) => {
  await signIn(page, ADMIN, `admin@${HOST}`, LAB_PASSWORD);

  // Reached from the identity block, not the rail — Account is who is doing the
  // work, not one of the console's jobs.
  await page.getByTestId("user-menu").click();
  await page.getByTestId("menu-account").click();
  await expect(page).toHaveURL(`${ADMIN}/account`);
  await expect(page.getByTestId("account-email")).toHaveText(`admin@${HOST}`);

  // The list that matters here: an operator's support sessions show up in it.
  await expect(
    page.getByTestId("session-row").filter({ hasText: "This device" }),
  ).toHaveCount(1);

  // close_account refuses a platform_admin outright, so offering the button
  // would only ever produce a 403.
  await expect(page.getByTestId("close-account")).toHaveCount(0);

  // And the edit reaches the chrome, which is the point of being able to make it.
  await page.getByTestId("profile-name").fill("Ada Operator");
  await page.getByTestId("profile-save").click();
  await expect(page.getByText("Profile saved")).toBeVisible();
  await expect(page.getByTestId("user-menu")).toContainText("Ada Operator");
});
