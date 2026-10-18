import { describe, it, expect } from "vitest";
import { localTodayYmd } from "./today";

describe("localTodayYmd", () => {
  it("formats the local date, zero-padded", () => {
    expect(localTodayYmd(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
  });
});
