/**
 * Catalog e2e tests — require live TMDB network access via the dev server.
 * These tests may be flaky in CI environments without internet access or if
 * the TMDB API is temporarily unavailable.
 */
import { test, expect } from "@playwright/test";

test("home shows a trending rail", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /trending/i })).toBeVisible({ timeout: 15000 });
});

test("search returns results and links to a title", async ({ page }) => {
  await page.goto("/search?q=matrix");
  const firstTitle = page.getByRole("link", { name: /matrix/i }).first();
  await expect(firstTitle).toBeVisible({ timeout: 15000 });
});

test("title detail page renders", async ({ page }) => {
  await page.goto("/title/movie/603-the-matrix");
  await expect(page.getByRole("heading", { name: /matrix/i }).first()).toBeVisible({
    timeout: 15000,
  });
});

test("footer shows TMDB attribution", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/TMDB/i)).toBeVisible();
});
