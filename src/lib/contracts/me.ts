import { z } from "zod";

export const mediaType = z.enum(["movie", "tv"]);
export const watchStatus = z.enum(["want_to_watch", "watching", "watched"]);

export const titleRef = z.object({ mediaType, tmdbId: z.number().int().positive() });
export const setWatchInput = titleRef.extend({ status: watchStatus });
export const setRatingInput = titleRef.extend({ score: z.number().int().min(1).max(5) });
export const updateProfileInput = z.object({ region: z.string().length(2).toUpperCase() });

export type SetWatchInput = z.infer<typeof setWatchInput>;
export type SetRatingInput = z.infer<typeof setRatingInput>;
