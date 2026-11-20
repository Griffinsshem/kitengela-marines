import { expect, test, type Page } from "@playwright/test";

import { expectAccessible } from "./axe";

const email = process.env.E2E_ADMIN_EMAIL ?? "admin@example.com";
const password = process.env.E2E_ADMIN_PASSWORD ?? "e2e-admin-password-long";

async function signIn(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(
    page.getByRole("navigation", { name: "Administration" }),
  ).toBeVisible();
}

test.describe("admin", () => {
  test("the sign-in page is accessible and refuses a wrong password", async ({
    page,
  }) => {
    await page.goto("/admin/login");
    await expectAccessible(page);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Incorrect email or password.")).toBeVisible();
  });

  test("an editor signs in and sees every fixture", async ({ page }) => {
    await signIn(page);
    await page
      .getByRole("navigation", { name: "Administration" })
      .getByRole("link", { name: "Fixtures" })
      .click();
    await expect(page.getByText("Marines v Isinya Rovers")).toBeVisible();
    await expect(page.getByText("Starlets v Athi River United")).toBeVisible();
    await expectAccessible(page);
  });

  test("leaving an article with unsaved changes asks first", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/admin/news/new");
    await page.getByLabel("Title").fill("Half-written match report");

    const nav = page.getByRole("navigation", { name: "Administration" });
    let asked = "";
    page.once("dialog", async (dialog) => {
      asked = dialog.message();
      await dialog.dismiss();
    });
    await nav.getByRole("link", { name: "Fixtures" }).click();

    expect(asked).toMatch(/not saved/i);
    await expect(page).toHaveURL(/\/admin\/news\/new$/);
    await expect(page.getByLabel("Title")).toHaveValue(
      "Half-written match report",
    );

    // Accepting lets the editor go.
    page.once("dialog", (dialog) => dialog.accept());
    await nav.getByRole("link", { name: "Fixtures" }).click();
    await expect(page).toHaveURL(/\/admin\/fixtures$/);
  });
});
