import { z } from "zod";
import { titleRef } from "./me";

export const createPollInput = z.object({
  title: z.string().trim().min(1).max(120),
  expectedVoters: z.number().int().min(2).max(50),
  // ISO datetime; optional — when omitted the creator can close at any time.
  deadline: z.string().datetime().nullable().optional(),
});

export const castVoteInput = titleRef;

export type CreatePollInput = z.infer<typeof createPollInput>;
