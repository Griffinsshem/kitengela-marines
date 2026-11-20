import { expect, test } from "@playwright/test";

import { expectAccessible } from "./axe";

test.describe("public site", () => {
  test("home page shows the next match and the latest result", async ({
    page,
  }) => {
    await page.goto("/");
    // Some names appear twice (a mobile and a desktop layout); one must show.
    await expect(
      page.getByText("Isinya Rovers").filter({ visible: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByText("Athi River United").filter({ visible: true }).first(),
    ).toBeVisible();
    await expectAccessible(page);
  });

  for (const path of [
    "/fixtures",
    "/results",
    "/teams",
    "/teams/marines-men",
    "/contact",
    "/club",
  ]) {
    test(`${path} renders and is accessible`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("main")).toBeVisible();
      await expectAccessible(page);
    });
  }

  test("a match page describes itself to search engines", async ({ page }) => {
    await page.goto("/matches/athi-river-united-v-starlets");
    await expect(page.getByText("A late winner on the road.")).toBeVisible();

    const structured = await page
      .locator('script[type="application/ld+json"]')
      .first()
      .textContent();
    expect(JSON.parse(structured ?? "{}")).toMatchObject({
      "@type": "SportsEvent",
      homeTeam: { name: "Athi River United" },
      awayTeam: { name: "Marines Starlets" },
    });
    await expectAccessible(page);
  });

  test("an unknown page is a 404 with a way home", async ({ page }) => {
    const response = await page.goto("/no-such-page");
    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole("link", { name: /home/i }).first(),
    ).toBeVisible();
  });

  test("the contact form sends a message", async ({ page }) => {
    await page.goto("/contact");
    await page.getByLabel("Your name").fill("E2E Tester");
    await page.getByLabel("Email").fill("e2e@example.com");
    await page
      .getByLabel("Message")
      .fill("Checking the contact form works end to end.");
    // The API drops messages answered faster than a person could.
    await page.waitForTimeout(4_000);
    await page.getByRole("button", { name: /send/i }).click();
    await expect(page.getByText("Message sent")).toBeVisible();
  });
});
