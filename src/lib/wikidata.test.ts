import { vi, test, expect, beforeEach, afterEach, type Mock } from "vitest";
import { sparql, resetWikidataBreaker } from "./wikidata";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const ok = (bindings: unknown[] = []) => ({
  ok: true,
  json: async () => ({ results: { bindings } }),
});

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

  (fetchMock as Mock).mockRejectedValueOnce(new Error("boom"));
  expect(await sparql("q", "test")).toBeNull();
});

test("opens after 5 consecutive failures and skips calls while open", async () => {
  (fetchMock as Mock).mockRejectedValue(new Error("boom"));
  for (let i = 0; i < 5; i++) await sparql("q", "test");
  expect(fetchMock).toHaveBeenCalledTimes(5);

  // Breaker is open: no fetch, instant null.
  expect(await sparql("q", "test")).toBeNull();
  expect(await sparql("q", "test")).toBeNull();
  expect(fetchMock).toHaveBeenCalledTimes(5);
});

test("half-opens after the window and one success closes it", async () => {
  (fetchMock as Mock).mockRejectedValue(new Error("boom"));
  for (let i = 0; i < 5; i++) await sparql("q", "test");

  vi.advanceTimersByTime(10 * 60_000 + 1);

  // The half-open probe goes through and succeeds, closing the breaker.
  (fetchMock as Mock).mockResolvedValue(ok());
  expect(await sparql("q", "test")).toEqual([]);
  expect(fetchMock).toHaveBeenCalledTimes(6);

  // Closed again: subsequent calls fetch normally.
  await sparql("q", "test");
  expect(fetchMock).toHaveBeenCalledTimes(7);
});

test("a failed half-open probe reopens for another full window", async () => {
  (fetchMock as Mock).mockRejectedValue(new Error("boom"));
  for (let i = 0; i < 5; i++) await sparql("q", "test");

  vi.advanceTimersByTime(10 * 60_000 + 1);
  await sparql("q", "test"); // half-open probe, fails
  expect(fetchMock).toHaveBeenCalledTimes(6);

  // Reopened: still skipping inside the new window.
  vi.advanceTimersByTime(5 * 60_000);
  expect(await sparql("q", "test")).toBeNull();
  expect(fetchMock).toHaveBeenCalledTimes(6);
});

test("a success between failures resets the consecutive count", async () => {
  (fetchMock as Mock).mockRejectedValue(new Error("boom"));
  for (let i = 0; i < 4; i++) await sparql("q", "test");

  (fetchMock as Mock).mockResolvedValueOnce(ok());
  await sparql("q", "test");

  (fetchMock as Mock).mockRejectedValue(new Error("boom"));
  for (let i = 0; i < 4; i++) await sparql("q", "test");

  // 4 + 4 failures with a success between never reaches 5 consecutive.
  await sparql("q", "test");
  expect(fetchMock).toHaveBeenCalledTimes(10);
});

test("an HTTP error status counts as a failure too", async () => {
  (fetchMock as Mock).mockResolvedValue({ ok: false, status: 429 });
  for (let i = 0; i < 5; i++) expect(await sparql("q", "test")).toBeNull();

  expect(await sparql("q", "test")).toBeNull();
  expect(fetchMock).toHaveBeenCalledTimes(5);
});
