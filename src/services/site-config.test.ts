import { vi, beforeEach } from "vitest";

vi.mock("./public-config", () => ({
  publishedOptions: vi.fn(),
  publishedBlock: vi.fn(),
}));

import { publishedOptions, publishedBlock } from "./public-config";
import { getBrandName, getNavLinks } from "./site-config";

beforeEach(() => vi.clearAllMocks());

test("brand falls back when no block", async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (publishedBlock as any).mockResolvedValue(null);
  expect(await getBrandName()).toBe("reco");
});

test("brand strips html and uses block body", async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (publishedBlock as any).mockResolvedValue({ key: "brand", title: "Brand", body: "<p>Reelium</p>" });
  expect(await getBrandName()).toBe("Reelium");
});

test("nav falls back when namespace empty", async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (publishedOptions as any).mockResolvedValue([]);
  expect(await getNavLinks()).toEqual([{ href: "/", label: "Home" }]);
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
