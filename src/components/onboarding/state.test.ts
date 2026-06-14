import { onboardingReducer, initialState, canProceed, MIN_GENRES, MIN_LIKES, type OnboardingState } from "./state";

test("toggles genres and gates step 1 on MIN_GENRES", () => {
  let s = initialState();
  expect(canProceed(s)).toBe(false);
  for (const g of [1, 2, 3]) s = onboardingReducer(s, { type: "toggleGenre", id: g });
  expect(s.genres.size).toBe(MIN_GENRES);
  expect(canProceed(s)).toBe(true);
  s = onboardingReducer(s, { type: "toggleGenre", id: 1 });
  expect(s.genres.has(1)).toBe(false);
});

test("like and dislike are mutually exclusive; titles step gates on MIN_LIKES", () => {
  let s: OnboardingState = { ...initialState(), step: "titles" as const };
  s = onboardingReducer(s, { type: "toggleLike", key: "movie:1" });
  s = onboardingReducer(s, { type: "toggleDislike", key: "movie:1" });
  expect(s.likes.has("movie:1")).toBe(false);
  expect(s.dislikes.has("movie:1")).toBe(true);
  expect(canProceed(s)).toBe(false);
  for (let i = 0; i < MIN_LIKES; i++) s = onboardingReducer(s, { type: "toggleLike", key: `movie:${100 + i}` });
  expect(canProceed(s)).toBe(true);
});
