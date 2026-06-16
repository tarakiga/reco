import { z } from "zod";

export const createListInput = z.object({
  title: z.string().trim().min(1).max(120),
  subtitle: z.string().trim().max(200).optional(),
});

export const updateListInput = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  subtitle: z.string().trim().max(200).nullable().optional(),
  published: z.boolean().optional(),
});

export const reorderItemsInput = z.object({
  orderedTitleIds: z.array(z.string().uuid()).min(1),
});

export const removeItemInput = z.object({
  titleId: z.string().uuid(),
});

export const setItemNoteInput = z.object({
  titleId: z.string().uuid(),
  note: z.string().max(500).nullable(),
});

export type CreateListInput = z.infer<typeof createListInput>;
export type UpdateListInput = z.infer<typeof updateListInput>;
