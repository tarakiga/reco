import { amazonSearchUrl, appleTvSearchUrl, fandangoTicketsUrl } from "./affiliates";

// The core guarantee: no id → no link (gates the frontend).
test("builders return null when the id is missing", () => {
  expect(amazonSearchUrl("Dune", 2021, null)).toBeNull();
  expect(amazonSearchUrl("Dune", 2021, "")).toBeNull();
  expect(appleTvSearchUrl("Dune", null)).toBeNull();
  expect(fandangoTicketsUrl("Dune", null)).toBeNull();
});

test("amazon link carries the tag, title and year", () => {
  const url = amazonSearchUrl("Dune", 2021, "haystackk-20")!;
  expect(url).toContain("tag=haystackk-20");
  expect(url).toContain("Dune%202021");
  expect(url).toContain("i=instant-video");
});

test("amazon link omits the year when unknown", () => {
  const url = amazonSearchUrl("Dune", null, "haystackk-20")!;
  expect(url).toContain("k=Dune&");
  expect(url).not.toContain("2021");
});

test("apple and fandango links carry their codes and encode the title", () => {
  expect(appleTvSearchUrl("Knives Out", "1000labc")).toBe(
    "https://tv.apple.com/search?term=Knives%20Out&at=1000labc",
  );
  expect(fandangoTicketsUrl("Knives Out", "cmp1")).toBe(
    "https://www.fandango.com/search?q=Knives%20Out&cmp=cmp1",
  );
});
