import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

export const HOST = process.env.HULL_HOST ?? "hull.test";
export const APP = `https://app.${HOST}`;
export const ADMIN = `https://admin.${HOST}`;
export const WWW = `https://${HOST}`;

export const LAB_PASSWORD = "demodemo1";

/** A fresh identity per test, so flows never collide over seeded state. */
/** Unique per run, so a rerun does not collide with the rows the last one left. */
export function unique(tag: string) {
  return `${tag}-${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
}

export function newUser(tag: string) {
  const id = `${tag}${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`.toLowerCase();
  return { username: id.slice(0, 24), email: `${id}@${HOST}`, password: LAB_PASSWORD };
}

export async function signUp(page: Page, user: ReturnType<typeof newUser>) {
  await page.goto(`${APP}/signup`);
  await page.getByTestId("auth-username").fill(user.username);
  await page.getByTestId("auth-email").fill(user.email);
  await page.getByTestId("auth-password").fill(user.password);
  await page.getByTestId("auth-submit").click();
  await page.getByTestId("auth-submit").waitFor({ state: "detached" });
}

/**
 * The admin app has no /signin route — it renders the sign-in screen at whatever
 * path when there is no session — so sign in at the origin root, not /signin.
 */
export async function signIn(page: Page, origin: string, email: string, password: string) {
  await page.goto(`${origin}/`);
  await page.getByTestId("auth-email").fill(email);
  await page.getByTestId("auth-password").fill(password);
  await page.getByTestId("auth-submit").click();
  // Wait for the form to go, not for a timer. Navigating straight after the click
  // aborts the sign-in request in flight and the next page load is anonymous.
  await page.getByTestId("auth-submit").waitFor({ state: "detached" });
}

/**
 * Sign in expecting it to be rejected. Kept separate from signIn on purpose: that
 * one waits for the form to go, which never happens when the credentials fail.
 */
export async function signInExpectingFailure(
  page: Page,
  origin: string,
  email: string,
  password: string,
) {
  await page.goto(`${origin}/`);
  await page.getByTestId("auth-email").fill(email);
  await page.getByTestId("auth-password").fill(password);
  await page.getByTestId("auth-submit").click();
}

/**
 * The token from an emailed link must not be left in the address bar — bookmarks,
 * history, a screenshot over someone's shoulder.
 *
 * Polled, not read once. `page.goto` resolves on `load`, which lands either side
 * of the app's first render depending on the machine; reading the URL at that
 * instant passed for months and then failed on every fragment page at once,
 * while the app was stripping correctly the whole time. What a browser cannot
 * tell apart at this granularity is stripping during render versus in an effect
 * one frame later — that distinction is a code-review property, and the comments
 * in Reset.tsx, Verify.tsx and EmailChange.tsx are where it is kept.
 */
export async function expectTokenStripped(page: Page) {
  await expect.poll(() => new URL(page.url()).hash, { timeout: 5_000 }).toBe("");
}

/** Name the first workspace — the step signup hands you straight into. */
export async function createFirstOrg(page: Page, name: string) {
  await page.getByTestId("org-name").fill(name);
  await page.getByTestId("org-submit").click();
}
