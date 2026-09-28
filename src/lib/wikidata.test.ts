import { vi, test, expect, beforeEach, afterEach, type Mock } from "vitest";
import { sparql, resetWikidataBreaker } from "./wikidata";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const ok = (bindings: unknown[] = []) => ({
  ok: true,
  json: async () => ({ results: { bindings } }),
});

const fail = () => (fetchMock as Mock).mockRejectedValueOnce(new Error("boom"));
const succeed = () => (fetchMock as Mock).mockResolvedValueOnce(ok());

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-28T00:00:00Z"));
  resetWikidataBreaker();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

test("returns bindings on success and null on a failed fetch", async () => {
  (fetchMock as Mock).mockResolvedValueOnce(ok([{ x: { value: "1" } }]));
  expect(await sparql("q", "test")).toEqual([{ x: { value: "1" } }]);

  fail();
  expect(await sparql("q", "test")).toBeNull();
});

test("opens after 5 failures in the window and skips calls while open", async () => {
  (fetchMock as Mock).mockRejectedValue(new Error("boom"));
  for (let i = 0; i < 5; i++) await sparql("q", "test");
  expect(fetchMock).toHaveBeenCalledTimes(5);

  // Breaker is open: no fetch, instant null.
  expect(await sparql("q", "test")).toBeNull();
  expect(await sparql("q", "test")).toBeNull();
  expect(fetchMock).toHaveBeenCalledTimes(5);
});

test("interleaved successes do NOT stop the window from filling", async () => {
  // The production failure mode of the first breaker: Wikidata throttling is
  // probabilistic, so successes between failures reset a consecutive counter
  // and it never tripped. Failure RATE is what matters.
  for (let i = 0; i < 4; i++) {
    fail();
    await sparql("q", "test");
    succeed();
    await sparql("q", "test");
    vi.advanceTimersByTime(10_000);
  }
  fail();
  await sparql("q", "test"); // 5th failure inside the 5 minute window

  // Open now: skipped without fetching.
  expect(await sparql("q", "test")).toBeNull();
  expect(fetchMock).toHaveBeenCalledTimes(9);
});

test("failures older than the window do not count", async () => {
  (fetchMock as Mock).mockRejectedValue(new Error("boom"));
  for (let i = 0; i < 4; i++) await sparql("q", "test");

  vi.advanceTimersByTime(6 * 60_000); // the 4 failures age out

  await sparql("q", "test");
  // Not open: this was 1 failure in the current window.
  await sparql("q", "test");
  expect(fetchMock).toHaveBeenCalledTimes(6);
});

test("half-opens after the open window and one success closes it fully", async () => {
  (fetchMock as Mock).mockRejectedValue(new Error("boom"));
  for (let i = 0; i < 5; i++) await sparql("q", "test");

  vi.advanceTimersByTime(10 * 60_000 + 1);

  succeed();
  expect(await sparql("q", "test")).toEqual([]); // half-open probe succeeds
  expect(fetchMock).toHaveBeenCalledTimes(6);

  // Fully closed: a single later blip must NOT reopen on its own.
  fail();
  await sparql("q", "test");
  succeed();
  await sparql("q", "test");
  expect(fetchMock).toHaveBeenCalledTimes(8);
});

test("a failed half-open probe reopens for another full window", async () => {
  (fetchMock as Mock).mockRejectedValue(new Error("boom"));
  for (let i = 0; i < 5; i++) await sparql("q", "test");

  vi.advanceTimersByTime(10 * 60_000 + 1);
  await sparql("q", "test"); // half-open probe, fails
  expect(fetchMock).toHaveBeenCalledTimes(6);

  // Reopened immediately: still skipping well inside the new window.
  vi.advanceTimersByTime(5 * 60_000);
  expect(await sparql("q", "test")).toBeNull();
  expect(fetchMock).toHaveBeenCalledTimes(6);
});

test("an HTTP error status counts as a failure too", async () => {
  (fetchMock as Mock).mockResolvedValue({ ok: false, status: 429 });
  for (let i = 0; i < 5; i++) expect(await sparql("q", "test")).toBeNull();

  expect(await sparql("q", "test")).toBeNull();
  expect(fetchMock).toHaveBeenCalledTimes(5);
});
