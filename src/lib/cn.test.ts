import { cn } from "./cn";

test("merges class names", () => {
  expect(cn("a", "b")).toBe("a b");
});

test("drops falsy values", () => {
  expect(cn("a", false && "b", undefined)).toBe("a");
});

test("later tailwind classes win conflicts", () => {
  expect(cn("px-2", "px-4")).toBe("px-4");
});
