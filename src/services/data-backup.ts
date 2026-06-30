import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  favourites,
  ratings,
  watchlistItems,
  lists,
  listItems,
  diary,
  tags,
  titleTags,
  guideChannels,
  titles,
  profiles,
} from "@/db/schema";
import { getOrCreateTitle } from "./catalog";
import { slugify } from "@/lib/slug";
import type { BackupData } from "@/lib/contracts/backup";

export const BACKUP_VERSION = 1;

type Ref = { mediaType: "movie" | "tv"; tmdbId: number };
const refKey = (mt: string, id: number) => `${mt}:${id}`;
// CockroachDB INT8 (tmdb_id) can arrive as a string via the driver, normalise.
const n = (v: unknown): number => Number(v);

/**
 * Full export of a user's data, keyed by stable (mediaType, tmdbId) so the
 * backup survives any database change. Excludes derived data (taste embedding)
 * and transient poll votes.
 */
export async function exportUserData(userId: string): Promise<BackupData & { exportedAt: string; username: string | null }> {
  const fav = await db
    .select({ mediaType: titles.mediaType, tmdbId: titles.tmdbId })
    .from(favourites)
    .innerJoin(titles, eq(favourites.titleId, titles.id))
    .where(eq(favourites.userId, userId));

  const rat = await db
    .select({ mediaType: titles.mediaType, tmdbId: titles.tmdbId, score: ratings.score })
    .from(ratings)
    .innerJoin(titles, eq(ratings.titleId, titles.id))
    .where(eq(ratings.userId, userId));

  const watch = await db
    .select({ mediaType: titles.mediaType, tmdbId: titles.tmdbId, status: watchlistItems.status })
    .from(watchlistItems)
    .innerJoin(titles, eq(watchlistItems.titleId, titles.id))
    .where(eq(watchlistItems.userId, userId));

  const userLists = await db.select().from(lists).where(eq(lists.userId, userId));
  const listsOut = [];
  for (const l of userLists) {
    const items = await db
      .select({
        mediaType: titles.mediaType,
        tmdbId: titles.tmdbId,
        note: listItems.note,
        position: listItems.position,
        tier: listItems.tier,
        season: listItems.seasonNumber,
        episode: listItems.episodeNumber,
        episodeName: listItems.episodeName,
      })
      .from(listItems)
      .innerJoin(titles, eq(listItems.titleId, titles.id))
      .where(eq(listItems.listId, l.id))
      .orderBy(listItems.position);
    listsOut.push({
      title: l.title,
      subtitle: l.subtitle,
      published: l.published,
      tiered: l.tiered,
      items: items.map((it) => ({
        mediaType: it.mediaType,
        tmdbId: n(it.tmdbId),
        note: it.note,
        position: it.position,
        tier: it.tier,
        season: it.season,
        episode: it.episode,
        episodeName: it.episodeName,
      })),
    });
  }

  const dia = await db
    .select({ mediaType: titles.mediaType, tmdbId: titles.tmdbId, watchedOn: diary.watchedOn })
    .from(diary)
    .innerJoin(titles, eq(diary.titleId, titles.id))
    .where(eq(diary.userId, userId));

  const userTags = await db.select().from(tags).where(eq(tags.userId, userId));
  const tagsOut = [];
  for (const t of userTags) {
    const tagged = await db
      .select({ mediaType: titles.mediaType, tmdbId: titles.tmdbId })
      .from(titleTags)
      .innerJoin(titles, eq(titleTags.titleId, titles.id))
      .where(eq(titleTags.tagId, t.id));
    tagsOut.push({ name: t.name, titles: tagged.map((tt) => ({ mediaType: tt.mediaType, tmdbId: n(tt.tmdbId) })) });
  }

  const gc = await db.select().from(guideChannels).where(eq(guideChannels.userId, userId));
  const guideChannelsOut: Record<string, string[]> = {};
  for (const g of gc) guideChannelsOut[g.country] = g.channels ?? [];

  const [prof] = await db.select().from(profiles).where(eq(profiles.id, userId));

  return {
    haystackkBackup: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    username: prof?.username ?? null,
    profile: { region: prof?.region ?? null, preferredGenres: prof?.preferredGenres ?? null },
    favourites: fav.map((r) => ({ mediaType: r.mediaType, tmdbId: n(r.tmdbId) })),
    ratings: rat.map((r) => ({ mediaType: r.mediaType, tmdbId: n(r.tmdbId), score: r.score })),
    watchlist: watch.map((r) => ({ mediaType: r.mediaType, tmdbId: n(r.tmdbId), status: r.status })),
    lists: listsOut,
    diary: dia.map((r) => ({ mediaType: r.mediaType, tmdbId: n(r.tmdbId), watchedOn: r.watchedOn })),
    tags: tagsOut,
    guideChannels: guideChannelsOut,
  };
}

/** Resolve every referenced (mediaType, tmdbId) to a titles.id. Existing titles
 *  are fetched in one query each per media type; misses go through TMDB. */
async function resolveTitleIds(refs: Ref[]): Promise<Map<string, string>> {
  const uniq = new Map<string, Ref>();
  for (const r of refs) uniq.set(refKey(r.mediaType, r.tmdbId), r);
  const all = [...uniq.values()];
  const map = new Map<string, string>();

  for (const mt of ["movie", "tv"] as const) {
    const ids = all.filter((r) => r.mediaType === mt).map((r) => r.tmdbId);
    if (!ids.length) continue;
    const rows = await db
      .select({ id: titles.id, tmdbId: titles.tmdbId })
      .from(titles)
      .where(and(eq(titles.mediaType, mt), inArray(titles.tmdbId, ids)));
    for (const row of rows) map.set(refKey(mt, row.tmdbId), row.id);
  }

  for (const r of all) {
    const k = refKey(r.mediaType, r.tmdbId);
    if (map.has(k)) continue;
    try {
      const t = await getOrCreateTitle(r.mediaType, r.tmdbId);
      if (t.id) map.set(k, t.id);
    } catch {
      // unresolvable (404/adult/etc.), skip; counted as skipped below
    }
  }
  return map;
}

export interface ImportSummary {
  favourites: number;
  ratings: number;
  watchlist: number;
  lists: number;
  listItems: number;
  diary: number;
  tags: number;
  taggedTitles: number;
  guideChannels: number;
  skipped: number;
}

/**
 * Merge a backup into the user's account. Idempotent and additive, existing
 * data is never deleted; rows already present are left as-is (or updated, for
 * ratings/watchlist status). Titles not yet in the catalogue are resolved via
 * TMDB. Returns a per-section count.
 */
export async function importUserData(userId: string, data: BackupData): Promise<ImportSummary> {
  const refs: Ref[] = [
    ...(data.favourites ?? []),
    ...(data.ratings ?? []),
    ...(data.watchlist ?? []),
    ...(data.lists ?? []).flatMap((l) => l.items ?? []),
    ...(data.diary ?? []),
    ...(data.tags ?? []).flatMap((t) => t.titles ?? []),
  ];
  const ids = await resolveTitleIds(refs);
  const tid = (r: Ref) => ids.get(refKey(r.mediaType, r.tmdbId));
  const s: ImportSummary = {
    favourites: 0, ratings: 0, watchlist: 0, lists: 0, listItems: 0, diary: 0, tags: 0, taggedTitles: 0, guideChannels: 0, skipped: 0,
  };
  // Chunk so a big library is a handful of statements, not one round-trip per row.
  const CHUNK = 500;
  const chunked = <T>(arr: T[]): T[][] => {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += CHUNK) out.push(arr.slice(i, i + CHUNK));
    return out;
  };

  const favVals: { userId: string; titleId: string }[] = [];
  for (const r of data.favourites ?? []) {
    const t = tid(r);
    if (t) favVals.push({ userId, titleId: t }); else s.skipped++;
  }
  for (const c of chunked(favVals)) await db.insert(favourites).values(c).onConflictDoNothing();
  s.favourites = favVals.length;

  const ratVals: { userId: string; titleId: string; score: number }[] = [];
  for (const r of data.ratings ?? []) {
    const t = tid(r);
    if (t) ratVals.push({ userId, titleId: t, score: r.score }); else s.skipped++;
  }
  for (const c of chunked(ratVals))
    await db.insert(ratings).values(c).onConflictDoUpdate({ target: [ratings.userId, ratings.titleId], set: { score: sql`excluded.score` } });
  s.ratings = ratVals.length;

  const watchVals: { userId: string; titleId: string; status: "want_to_watch" | "watching" | "watched" }[] = [];
  for (const r of data.watchlist ?? []) {
    const t = tid(r);
    if (t) watchVals.push({ userId, titleId: t, status: r.status }); else s.skipped++;
  }
  for (const c of chunked(watchVals))
    await db.insert(watchlistItems).values(c).onConflictDoUpdate({ target: [watchlistItems.userId, watchlistItems.titleId], set: { status: sql`excluded.status` } });
  s.watchlist = watchVals.length;

  const diaryVals: { userId: string; titleId: string; watchedOn: string }[] = [];
  for (const r of data.diary ?? []) {
    const t = tid(r);
    if (t) diaryVals.push({ userId, titleId: t, watchedOn: r.watchedOn }); else s.skipped++;
  }
  for (const c of chunked(diaryVals)) await db.insert(diary).values(c).onConflictDoNothing();
  s.diary = diaryVals.length;

  for (const l of data.lists ?? []) {
    // Reuse an existing same-named list so re-imports don't duplicate it.
    const [existing] = await db.select({ id: lists.id }).from(lists).where(and(eq(lists.userId, userId), eq(lists.title, l.title)));
    let listId = existing?.id;
    if (!listId) {
      const [created] = await db
        .insert(lists)
        .values({ userId, title: l.title, subtitle: l.subtitle ?? null, slug: slugify(l.title) || "list", published: l.published ?? false, tiered: l.tiered ?? false })
        .returning({ id: lists.id });
      listId = created.id;
      s.lists++;
    }
    type ItemVal = {
      listId: string;
      titleId: string;
      position: number;
      note: string | null;
      tier: string | null;
      seasonNumber: number;
      episodeNumber: number;
      episodeName: string | null;
    };
    const itemVals: ItemVal[] = [];
    for (const it of l.items ?? []) {
      const t = tid(it);
      if (t)
        itemVals.push({
          listId,
          titleId: t,
          position: it.position ?? 0,
          note: it.note ?? null,
          tier: it.tier ?? null,
          seasonNumber: it.season ?? 0,
          episodeNumber: it.episode ?? 0,
          episodeName: it.episodeName ?? null,
        });
      else s.skipped++;
    }
    // Update the mutable item attributes on conflict so restoring a backup
    // actually restores tier buckets and ordering (not just additive inserts).
    for (const c of chunked(itemVals))
      await db
        .insert(listItems)
        .values(c)
        .onConflictDoUpdate({
          target: [listItems.listId, listItems.titleId, listItems.seasonNumber, listItems.episodeNumber],
          set: { tier: sql`excluded.tier`, position: sql`excluded.position`, note: sql`excluded.note` },
        });
    s.listItems += itemVals.length;
  }

  for (const tag of data.tags ?? []) {
    const slug = slugify(tag.name) || "tag";
    const [existing] = await db.select({ id: tags.id }).from(tags).where(and(eq(tags.userId, userId), eq(tags.slug, slug)));
    let tagId = existing?.id;
    if (!tagId) {
      const [created] = await db.insert(tags).values({ userId, name: tag.name, slug }).returning({ id: tags.id });
      tagId = created.id;
      s.tags++;
    }
    const ttVals: { tagId: string; titleId: string }[] = [];
    for (const tt of tag.titles ?? []) {
      const t = tid(tt);
      if (t) ttVals.push({ tagId, titleId: t }); else s.skipped++;
    }
    for (const c of chunked(ttVals)) await db.insert(titleTags).values(c).onConflictDoNothing();
    s.taggedTitles += ttVals.length;
  }

  for (const [country, channels] of Object.entries(data.guideChannels ?? {})) {
    await db
      .insert(guideChannels)
      .values({ userId, country, channels })
      .onConflictDoUpdate({ target: [guideChannels.userId, guideChannels.country], set: { channels, updatedAt: new Date() } });
    s.guideChannels++;
  }

  if (data.profile) {
    const upd: { region?: string; preferredGenres?: number[] } = {};
    if (data.profile.region) upd.region = data.profile.region;
    if (Array.isArray(data.profile.preferredGenres)) upd.preferredGenres = data.profile.preferredGenres;
    if (Object.keys(upd).length) await db.update(profiles).set(upd).where(eq(profiles.id, userId));
  }

  return s;
}
