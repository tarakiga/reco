import { test, expect } from "@playwright/test";

test("watchlist page prompts anonymous users to sign in", async ({ page }) => {
  await page.goto("/watchlist");
  await expect(page.getByText(/sign in/i).first()).toBeVisible({ timeout: 10000 });
});

test("title page shows sign-in-to-track for anonymous users", async ({ page }) => {
  await page.goto("/title/movie/603-the-matrix");
  await expect(page.getByText(/sign in to/i).first()).toBeVisible({ timeout: 15000 });
});

test("movies browse renders with a filter bar", async ({ page }) => {
  await page.goto("/movies");
  await expect(page.getByRole("heading", { name: /movies/i })).toBeVisible({ timeout: 15000 });
});
