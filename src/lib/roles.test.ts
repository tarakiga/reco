import { hasRole } from "./roles";

test("role ranking", () => {
  expect(hasRole("admin", "editor")).toBe(true);
  expect(hasRole("admin", "admin")).toBe(true);
  expect(hasRole("editor", "admin")).toBe(false);
  expect(hasRole("editor", "editor")).toBe(true);
  expect(hasRole("user", "editor")).toBe(false);
});
