import { parseMediaIntent } from "./intent";

test("detects tv intent and strips the media word + leading filler", () => {
  const r = parseMediaIntent("Tvshow where with girls in a dorm");
  expect(r.mediaType).toBe("tv");
  expect(r.cleaned).toBe("girls in a dorm");
});

test("detects movie intent", () => {
  const r = parseMediaIntent("a movie about a heist gone wrong");
  expect(r.mediaType).toBe("movie");
  expect(r.cleaned).toBe("heist gone wrong");
});

test("detects sitcom and film phrasing", () => {
  expect(parseMediaIntent("sitcom set in a coffee shop").mediaType).toBe("tv");
  expect(parseMediaIntent("the film with the spinning top").mediaType).toBe("movie");
});

test("no media word → null and query preserved", () => {
  const r = parseMediaIntent("giant squid attacks a cruise ship");
  expect(r.mediaType).toBeNull();
  expect(r.cleaned).toBe("giant squid attacks a cruise ship");
});

test("does NOT treat bare 'series' as intent (avoids mangling titles)", () => {
  const r = parseMediaIntent("a series of unfortunate events");
  expect(r.mediaType).toBeNull();
  expect(r.cleaned.toLowerCase()).toContain("series of unfortunate events");
});

test("ambiguous (both movie and tv words) → no filter", () => {
  expect(parseMediaIntent("is it a movie or a tv show about cars").mediaType).toBeNull();
});

test("keeps mid-sentence 'with'", () => {
  expect(parseMediaIntent("a man with a metal arm").cleaned).toBe("man with a metal arm");
});
