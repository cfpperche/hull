import { expect, test } from "@playwright/test";
import { ADMIN, APP, LAB_PASSWORD, createFirstOrg, newUser, signIn, signUp, unique } from "./helpers";

/**
 * The hand-off. The session cookie is host-scoped, so admin.<host> cannot carry a
 * session to app.<host>; it passes a single-use token in a URL fragment instead.
 * This flow crosses two origins, a token exchange and a redirect — none of which
 * an API test observes.
 */
test("View as opens the workspace, and Stop returns to the console", async ({ page }) => {
  const customer = newUser("sup");
  await signUp(page, customer);
  const org = unique("Customer Co");
  await createFirstOrg(page, org);
  await page.getByTestId("user-menu").click();
  await page.getByTestId("sign-out").click();

  await signIn(page, ADMIN, `admin@${process.env.HULL_HOST ?? "hull.test"}`, LAB_PASSWORD);
  await page.goto(`${ADMIN}/orgs`);

  const row = page.getByRole("row", { name: org });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "View as" }).click();

  // Lands on the product surface, impersonating.
  await expect(page).toHaveURL(new RegExp(`^${APP}/`));
  await expect(page.getByTestId("support-banner")).toContainText(org);
  // The token must not survive in the address bar.
  expect(new URL(page.url()).hash).toBe("");
  // The operator is still themselves, viewing someone else's workspace.
  await expect(page.getByTestId("user-menu")).toContainText("admin");

  await page.getByTestId("support-stop").click();
  await expect(page).toHaveURL(new RegExp(`^${ADMIN}/`));
  await expect(page.getByRole("link", { name: "Workspaces" })).toBeVisible();
});

test("a hand-off link cannot be replayed", async ({ page, playwright }) => {
  const host = process.env.HULL_HOST ?? "hull.test";
  const admin = await playwright.request.newContext({ baseURL: ADMIN, ignoreHTTPSErrors: true });
  await admin.post("/api/v1/auth/signin", {
    data: { email: `admin@${host}`, password: LAB_PASSWORD },
  });
  const orgs = await (await admin.get("/api/v1/admin/orgs")).json();
  const minted = await admin.post("/api/v1/admin/support", {
    data: { org_id: orgs.orgs[0].id },
  });
  const { handoff } = await minted.json();

  await page.goto(`${APP}/handoff#t=${encodeURIComponent(handoff)}`);
  await expect(page.getByTestId("support-banner")).toBeVisible();

  // Same token, second browser context.
  await page.context().clearCookies();
  await page.goto(`${APP}/handoff#t=${encodeURIComponent(handoff)}`);
  await expect(page.getByText("hand-off link is invalid or expired")).toBeVisible();
  await admin.dispose();
});

test("the admin console links the lab services", async ({ page }) => {
  const host = process.env.HULL_HOST ?? "hull.test";
  await signIn(page, ADMIN, `admin@${host}`, LAB_PASSWORD);

  for (const [label, sub] of [
    ["Mail", "mail"],
    ["Objects", "rustfs"],
    ["Database", "db"],
  ] as const) {
    await expect(page.getByRole("link", { name: label })).toHaveAttribute(
      "href",
      `https://${sub}.${host}`,
    );
  }
});
