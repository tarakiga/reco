import { z } from "zod";
import { titleRef } from "./me";

export const onboardingTitleRef = titleRef;
export type OnboardingTitleRef = z.infer<typeof onboardingTitleRef>;

export const onboardingInput = z.object({
  genres: z.array(z.number().int()).max(30),
  likes: z.array(onboardingTitleRef).max(80),
  dislikes: z.array(onboardingTitleRef).max(40),
});
export type OnboardingInput = z.infer<typeof onboardingInput>;
