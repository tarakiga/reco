import { z } from "zod";
import { titleRef } from "./me";

export const createPollInput = z.object({
  title: z.string().trim().min(1).max(120),
  expectedVoters: z.number().int().min(2).max(50),
  // ISO datetime; optional — when omitted the creator can close at any time.
  deadline: z.string().datetime().nullable().optional(),
});

// Bounds match parseEpisodeSlug in src/lib/tmdb/detail.ts, so the URL parser and
// the vote endpoint agree on what counts as a plausible episode.
export const castVoteInput = titleRef
  .extend({
    seasonNumber: z.number().int().min(1).max(999).optional(),
    episodeNumber: z.number().int().min(1).max(9999).optional(),
  })
  .refine((v) => (v.seasonNumber == null) === (v.episodeNumber == null), {
    message: "season and episode must be given together",
  })
  .refine((v) => v.mediaType === "tv" || v.seasonNumber == null, {
    message: "only a TV show has episodes",
  });

export type CreatePollInput = z.infer<typeof createPollInput>;
