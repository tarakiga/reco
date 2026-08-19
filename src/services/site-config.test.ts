import { vi, beforeEach } from "vitest";

vi.mock("./public-config", () => ({
  publishedOptions: vi.fn(),
  publishedBlock: vi.fn(),
}));

import { publishedOptions, publishedBlock } from "./public-config";
import { getBrandName, getNavLinks } from "./site-config";
import { NAV_LINKS } from "@/lib/nav";

beforeEach(() => vi.clearAllMocks());

test("brand falls back when no block", async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (publishedBlock as any).mockResolvedValue(null);
  expect(await getBrandName()).toBe("Haystackk");
});

test("brand strips html and uses block body", async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (publishedBlock as any).mockResolvedValue({ key: "brand", title: "Brand", body: "<p>Reelium</p>" });
  expect(await getBrandName()).toBe("Reelium");
});

test("nav falls back when namespace empty", async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (publishedOptions as any).mockResolvedValue([]);
  // Compared against the constant, not a copy of it: the fallback nav is meant
  // to grow as pages are added, and snapshotting it here made this test fail on
  // four unrelated feature commits before anyone noticed.
  expect(await getNavLinks()).toEqual(NAV_LINKS);
});

test("nav maps published option values", async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (publishedOptions as any).mockResolvedValue([
    { key: "home", label: "Home", value: { href: "/", label: "Home" }, sortOrder: 0, enabled: true },
    { key: "movies", label: "Movies", value: { href: "/movies", label: "Movies" }, sortOrder: 1, enabled: true },
  ]);
  expect(await getNavLinks()).toEqual([
    { href: "/", label: "Home" },
    { href: "/movies", label: "Movies" },
  ]);
});
