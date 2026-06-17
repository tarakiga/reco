import { z } from "zod";
import { titleRef } from "./me";

export const addDiaryInput = titleRef.extend({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD"),
});

export const removeDiaryInput = z.object({
  entryId: z.string().uuid(),
});
