import { defineConfig, devices } from "@playwright/test";

// The apex follows .env, like everything else that derives a hostname.
const host = process.env.HULL_HOST ?? "hull.test";

export default defineConfig({
  testDir: "./tests",
  // Flows sign in as the same seeded users and mutate their state, so they must
  // not run against each other.
  workers: 1,
  fullyParallel: false,
  // No retries. A flaky E2E that passes on the second try teaches people to
  // re-run instead of to look, and this repo has already been bitten by checks
  // that passed while testing nothing.
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: `https://app.${host}`,
    // The stack uses its own CA. CI has no reason to trust it, and asserting on
    // trust is smoke.sh's job — see ADR-0012.
    ignoreHTTPSErrors: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
