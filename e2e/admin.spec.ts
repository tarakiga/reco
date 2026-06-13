import { test, expect } from "@playwright/test";

test("admin is gated for anonymous users", async ({ page }) => {
  await page.goto("/admin");
  // guard redirects to home; wait for URL to settle (PPR may do client-side meta-refresh)
  await page.waitForURL("**/", { timeout: 10_000 });
  // admin sidebar must NOT be present
  await expect(page.getByRole("navigation", { name: "Admin" })).toHaveCount(0);
  // home hero text is present — proves we landed on the home page, not admin
  await expect(page.getByText("Find what to watch.")).toBeVisible();
});

test("admin options page is gated for anonymous users", async ({ page }) => {
  await page.goto("/admin/options");
  await page.waitForURL("**/", { timeout: 10_000 });
  // confirm we are on home, not an admin page
  await expect(page.getByRole("navigation", { name: "Admin" })).toHaveCount(0);
});
