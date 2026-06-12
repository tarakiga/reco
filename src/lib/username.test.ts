import { usernameBase } from "./username";

test("derives base from email local part", () => {
  expect(usernameBase("Movie.Fan+42@example.com")).toBe("moviefan42");
});

test("strips non-alphanumerics and lowercases", () => {
  expect(usernameBase("Tár Wölf!")).toBe("trwlf");
});

test("pads short results", () => {
  expect(usernameBase("a@x.com")).toBe("usera");
});

test("truncates to 20 chars", () => {
  expect(usernameBase("abcdefghijklmnopqrstuvwxyz@x.com")).toBe("abcdefghijklmnopqrst");
});
