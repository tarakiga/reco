import { z } from "zod";

export const slug = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9-]*$/, "lowercase letters, digits, hyphens");

export const entityType = z.enum(["options_namespace", "content_block"]);

export const upsertOptionInput = z.object({
  namespace: slug,
  key: slug,
  label: z.string().min(1).max(120),
  value: z.unknown().optional(),
  sortOrder: z.number().int().min(0).optional(),
  enabled: z.boolean().optional(),
});
export type UpsertOptionInput = z.infer<typeof upsertOptionInput>;

export const deleteOptionInput = z.object({ namespace: slug, key: slug });

export const reorderInput = z.object({
  namespace: slug,
  orderedKeys: z.array(slug).min(1),
});
export type ReorderInput = z.infer<typeof reorderInput>;

export const publishInput = z.object({ entityType, entityKey: slug });
export type PublishInput = z.infer<typeof publishInput>;

export const rollbackInput = z.object({
  entityType,
  entityKey: slug,
  version: z.number().int().min(1),
});
export type RollbackInput = z.infer<typeof rollbackInput>;

export const upsertBlockInput = z.object({
  key: slug,
  title: z.string().min(1).max(160),
  body: z.string().min(1),
});
export type UpsertBlockInput = z.infer<typeof upsertBlockInput>;

/** Shape stored in options_namespace snapshots and served publicly. */
export const publishedOption = z.object({
  key: z.string(),
  label: z.string(),
  value: z.unknown().nullable(),
  sortOrder: z.number().int(),
  enabled: z.boolean(),
});
export type PublishedOption = z.infer<typeof publishedOption>;

export const publishedBlock = z.object({
  key: z.string(),
  title: z.string(),
  body: z.string(),
});
export type PublishedBlock = z.infer<typeof publishedBlock>;
