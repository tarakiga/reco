import { onboardingInput } from "./onboarding";

test("accepts a valid payload", () => {
  const parsed = onboardingInput.parse({
    genres: [28, 878],
    likes: [{ mediaType: "movie", tmdbId: 603 }],
    dislikes: [{ mediaType: "tv", tmdbId: 1396 }],
  });
  expect(parsed.likes).toHaveLength(1);
});

test("rejects bad mediaType and oversize arrays", () => {
  expect(() => onboardingInput.parse({ genres: [], likes: [{ mediaType: "x", tmdbId: 1 }], dislikes: [] })).toThrow();
  expect(() => onboardingInput.parse({ genres: Array(31).fill(1), likes: [], dislikes: [] })).toThrow();
});
