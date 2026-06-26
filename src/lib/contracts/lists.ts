import { z } from "zod";

export const createListInput = z.object({
  title: z.string().trim().min(1).max(120),
  subtitle: z.string().trim().max(200).optional(),
});

export const fromTagInput = z.object({
  slug: z.string().trim().min(1).max(120),
});

export const updateListInput = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  subtitle: z.string().trim().max(200).nullable().optional(),
  published: z.boolean().optional(),
  tiered: z.boolean().optional(),
  showAuthor: z.boolean().optional(),
});

/** Add a movie/show (no season/episode) or a specific TV episode to a list. */
export const addListItemInput = z
  .object({
    mediaType: z.enum(["movie", "tv"]),
    tmdbId: z.number().int().positive(),
    season: z.number().int().positive().optional(),
    episode: z.number().int().positive().optional(),
    episodeName: z.string().trim().max(300).optional(),
  })
  .refine((v) => (v.season == null) === (v.episode == null), {
    message: "season and episode must be provided together",
  })
  .refine((v) => v.season == null || v.mediaType === "tv", {
    message: "episodes are only valid for TV shows",
  });

// Items are addressed by their list_items.id (a show can appear as several
// episodes, so titleId alone no longer identifies one item).
export const reorderItemsInput = z.object({
  orderedItemIds: z.array(z.string().uuid()).min(1),
});

export const removeItemInput = z.object({
  itemId: z.string().uuid(),
});

// One item PATCH covers the note and/or the tier bucket.
export const patchListItemInput = z
  .object({
    itemId: z.string().uuid(),
    note: z.string().max(500).nullable().optional(),
    tier: z.enum(["S", "A", "B", "C"]).nullable().optional(),
  })
  .refine((v) => v.note !== undefined || v.tier !== undefined, {
    message: "Provide note and/or tier",
  });

export type CreateListInput = z.infer<typeof createListInput>;
export type UpdateListInput = z.infer<typeof updateListInput>;
export type AddListItemInput = z.infer<typeof addListItemInput>;
