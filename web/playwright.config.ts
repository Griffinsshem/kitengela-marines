import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against the real thing: the production build of the site,
 * the Flask API and PostgreSQL, seeded with `flask seed demo`.
 *
 * The API is started outside this file (CI starts it as a step; locally, run
 * it yourself) because it needs a database and its own environment. This
 * file starts only the built site.
 */
const port = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // Scroll-reveal animations hold content at zero opacity until it is in
    // view, and axe skips what it cannot see. With reduced motion the site
    // shows everything at once, so every check covers the whole page.
    reducedMotion: "reduce",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Lets a machine with a preinstalled Chromium skip the download.
        launchOptions: process.env.E2E_CHROMIUM
          ? { executablePath: process.env.E2E_CHROMIUM }
          : {},
      },
    },
  ],
  webServer: {
    command: `npm run start -- --port ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
