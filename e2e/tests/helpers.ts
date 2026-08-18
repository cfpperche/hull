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
  const id =
    `${tag}${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`.toLowerCase();
  // No username. Signup stopped asking for one, and a helper that still made
  // them up would keep every spec written against a form that no longer exists.
  return { email: `${id}@${HOST}`, password: LAB_PASSWORD };
}

/**
 * Fill the form and stop at the wall. What a person sees before their inbox.
 *
 * Separate from `signUp` because one spec needs the unconfirmed state itself —
 * and folding "and then confirm" into the only entry point would leave that spec
 * reconstructing the form by hand, which is how a helper and the screen it
 * drives drift apart.
 */
export async function signUpUnconfirmed(
  page: Page,
  user: ReturnType<typeof newUser>,
) {
  await page.goto(`${APP}/signup`);
  await page.getByTestId("auth-email").fill(user.email);
  await page.getByTestId("auth-password").fill(user.password);
  await page.getByTestId("auth-password-again").fill(user.password);
  await page.getByTestId("auth-submit").click();
  await page.getByTestId("auth-submit").waitFor({ state: "detached" });
}

/**
 * Sign up and come out the other side of the wall, with a usable session.
 *
 * Every account lands on the wall now, so every spec that wants the product has
 * to go through the inbox the way a person would. Kept here rather than bolted
 * onto each spec: a helper that stops short of a usable session is one every
 * caller has to remember to finish, and whoever forgets gets a failure that
 * reads as a broken product.
 */
export async function signUp(page: Page, user: ReturnType<typeof newUser>) {
  await signUpUnconfirmed(page, user);
  await confirmEmail(page, user.email);
}

/**
 * Redeem the confirmation link out of Mailpit, then come back.
 *
 * Filtered by recipient and by the link's shape rather than taking the newest
 * message: the lab inbox is shared across the whole run, and "newest" is a race
 * that lands on somebody else's mail.
 */
export async function confirmEmail(page: Page, address: string) {
  const wanted = /https:\/\/\S*\/verify#\S+/;
  for (let attempt = 0; attempt < 20; attempt++) {
    const list = await (
      await page.request.get(`https://mail.${HOST}/api/v1/messages?limit=50`)
    ).json();
    const mine = list.messages.filter((m: { To: { Address: string }[] }) =>
      m.To.some((t) => t.Address.toLowerCase() === address.toLowerCase()),
    );
    for (const m of mine) {
      const full = await (
        await page.request.get(`https://mail.${HOST}/api/v1/message/${m.ID}`)
      ).json();
      const found = wanted.exec(full.Text as string);
      if (found) {
        await page.goto(found[0]);
        await page.getByTestId("verify-continue").click();
        // Back at the product, past the wall.
        await page.getByTestId("confirm-wall").waitFor({ state: "detached" });
        return;
      }
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`no confirmation link mailed to ${address}`);
}

/**
 * The admin app has no /signin route — it renders the sign-in screen at whatever
 * path when there is no session — so sign in at the origin root, not /signin.
 */
export async function signIn(
  page: Page,
  origin: string,
  email: string,
  password: string,
) {
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
  await expect
    .poll(() => new URL(page.url()).hash, { timeout: 5_000 })
    .toBe("");
}

/** Name the first workspace — the step signup hands you straight into. */
/**
 * Clear the first-run screen. Both fields are required there, so both are filled
 * — a helper that skipped the name would leave every spec pressing a button that
 * is disabled, and the failure would read as a broken flow rather than a stale
 * helper.
 */
export async function createFirstOrg(
  page: Page,
  org: string,
  person = "Test Person",
) {
  await page.getByTestId("your-name").fill(person);
  await page.getByTestId("org-name").fill(org);
  await page.getByTestId("org-submit").click();
  // Wait for the screen to go, the way signUp waits for its button. This used to
  // return on the click and got away with it while the submit was one round
  // trip; the name made it two, and the next `page.goto` started aborting the
  // org creation mid-flight. The race was always there — it just had a smaller
  // window.
  await page.getByTestId("org-submit").waitFor({ state: "detached" });
}
