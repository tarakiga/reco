import { z } from "zod";
import { titleRef } from "./me";

export const addTitleTagInput = titleRef.extend({
  name: z.string().trim().min(1).max(40),
});

export const removeTitleTagInput = titleRef.extend({
  tagId: z.string().uuid(),
});

export const renameTagInput = z.object({
  name: z.string().trim().min(1).max(40),
});
