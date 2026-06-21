import { z } from "zod";

// Schema for an uploaded backup file. Titles are referenced by their stable
// (mediaType, tmdbId) pair so a backup is portable across databases. Generous
// upper bounds guard against absurd uploads while allowing big libraries.

const ref = z.object({
  mediaType: z.enum(["movie", "tv"]),
  // coerce: CockroachDB INT8 can serialise as a string, so accept either.
  tmdbId: z.coerce.number().int().positive(),
});

export const backupSchema = z
  .object({
    haystackkBackup: z.number().int().optional(),
    profile: z
      .object({
        region: z.string().length(2).nullable().optional(),
        preferredGenres: z.array(z.number().int().positive()).max(50).nullable().optional(),
      })
      .optional(),
    favourites: z.array(ref).max(20000).optional(),
    ratings: z.array(ref.extend({ score: z.number().int().min(1).max(5) })).max(20000).optional(),
    watchlist: z
      .array(ref.extend({ status: z.enum(["want_to_watch", "watching", "watched"]) }))
      .max(20000)
      .optional(),
    lists: z
      .array(
        z.object({
          title: z.string().min(1).max(120),
          subtitle: z.string().max(200).nullable().optional(),
          published: z.boolean().optional(),
          items: z
            .array(ref.extend({ note: z.string().max(500).nullable().optional(), position: z.number().int().optional() }))
            .max(20000)
            .optional(),
        }),
      )
      .max(500)
      .optional(),
    diary: z
      .array(ref.extend({ watchedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
      .max(20000)
      .optional(),
    tags: z
      .array(z.object({ name: z.string().min(1).max(60), titles: z.array(ref).max(20000).optional() }))
      .max(500)
      .optional(),
    guideChannels: z.record(z.string().max(40), z.array(z.string().max(160)).max(500)).optional(),
  })
  .passthrough();

export type BackupData = z.infer<typeof backupSchema>;
