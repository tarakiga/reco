import { test, expect } from "@playwright/test";

test("home renders the app shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("banner")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
  await expect(page.getByRole("contentinfo")).toBeVisible();
});

test("sign-in page renders the auth widget", async ({ page }) => {
  await page.goto("/sign-in");
  // Clerk renders a card; assert something stable:
  await expect(page.locator("form, .cl-rootBox").first()).toBeVisible({ timeout: 15_000 });
});
