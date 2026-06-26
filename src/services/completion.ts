import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/db";
import { titles, watchlistItems, ratings, diary } from "@/db/schema";
import { tmdb } from "@/lib/tmdb/client";
import { posterUrl } from "@/lib/tmdb/images";
import { titleSlug } from "@/lib/slug";
import type { TmdbTitleDetail, TmdbSearchItem } from "@/lib/tmdb/types";

export interface CompletionItem {
  key: string; // `${mediaType}:${tmdbId}`
  mediaType: "movie" | "tv";
  tmdbId: number;
  title: string;
  year: number | null;
  /** ISO date ("YYYY-MM-DD") or null — used to drop not-yet-released titles. */
  releaseDate: string | null;
  posterUrl: string | null;
  href: string;
}

export interface Progress {
  total: number;
  watched: number;
  /** Titles still to watch, in order. */
  remaining: CompletionItem[];
  /** Titles already seen, in order. */
  seen: CompletionItem[];
}

const WRITER_JOBS = new Set([
  "Writer", "Screenplay", "Story", "Author", "Novel", "Teleplay", "Characters", "Comic Book", "Book",
]);
const DIRECTOR_JOBS = new Set(["Director", "Co-Director"]);
// Talk-show / documentary "as themselves" credits aren't really part of an
// actor's body of work, and they badly inflate the "seen" denominator.
const SELF_ROLE = /\b(self|himself|herself|themselves)\b/i;

function toItem(c: TmdbSearchItem): CompletionItem | null {
  const mt = c.media_type;
  if (mt !== "movie" && mt !== "tv") return null;
  if (c.adult) return null;
  const name = c.title ?? c.name ?? "Untitled";
  const date = c.release_date ?? c.first_air_date ?? "";
  const year = date.length >= 4 ? Number(date.slice(0, 4)) : null;
  return {
    key: `${mt}:${c.id}`,
    mediaType: mt,
    tmdbId: c.id,
    title: name,
    year: Number.isFinite(year) ? year : null,
    releaseDate: date || null,
    posterUrl: posterUrl(c.poster_path),
    href: `/title/${mt}/${c.id}-${titleSlug(name, date || null)}`,
  };
}

/**
 * Drop not-yet-released titles (future-dated) so the completion denominator only
 * counts what you can actually watch. Undated titles are kept (usually old
 * catalogue, not upcoming). Call at request time, not inside a cached function.
 */
export function releasedItems(items: CompletionItem[]): CompletionItem[] {
  const today = new Date().toISOString().slice(0, 10);
  return items.filter((i) => !i.releaseDate || i.releaseDate <= today);
}

function dedupe(items: (CompletionItem | null)[]): CompletionItem[] {
  const seen = new Set<number>();
  const out: CompletionItem[] = [];
  for (const it of items) {
    if (!it || seen.has(it.tmdbId)) continue;
    seen.add(it.tmdbId);
    out.push(it);
  }
  return out;
}

/** Compute a watched/total split for a set against the user's watched keys. */
export function progressFor(items: CompletionItem[], watched: Set<string>): Progress {
  const seen = items.filter((i) => watched.has(i.key));
  const remaining = items.filter((i) => !watched.has(i.key));
  return { total: items.length, watched: seen.length, remaining, seen };
}

// ---------------------------------------------------------------------------
// Watched signal (diary + rating + watchlist "watched")
// ---------------------------------------------------------------------------

/** Internal title ids the user has "watched" (any of the three signals). */
async function watchedTitleIds(userId: string): Promise<string[]> {
  const [w, r, d] = await Promise.all([
    db
      .select({ titleId: watchlistItems.titleId })
      .from(watchlistItems)
      .where(and(eq(watchlistItems.userId, userId), eq(watchlistItems.status, "watched"))),
    db.select({ titleId: ratings.titleId }).from(ratings).where(eq(ratings.userId, userId)),
    db.select({ titleId: diary.titleId }).from(diary).where(eq(diary.userId, userId)),
  ]);
  return [...new Set([...w, ...r, ...d].map((x) => x.titleId))];
}

/** `${mediaType}:${tmdbId}` keys the user has watched — for set intersection. */
export async function watchedTitleKeys(userId: string): Promise<Set<string>> {
  const ids = await watchedTitleIds(userId);
  if (ids.length === 0) return new Set();
  const rows = await db
    .select({ mediaType: titles.mediaType, tmdbId: titles.tmdbId })
    .from(titles)
    .where(inArray(titles.id, ids));
  return new Set(rows.map((r) => `${r.mediaType}:${r.tmdbId}`));
}

// ---------------------------------------------------------------------------
// Person body-of-work (acting / directing / writing)
// ---------------------------------------------------------------------------

export interface PersonSets {
  acted: CompletionItem[];
  directed: CompletionItem[];
  wrote: CompletionItem[];
}

/** A person's full movie/TV credits split by role. Cached per person. */
export async function personSets(personId: number): Promise<PersonSets> {
  "use cache";
  cacheLife("days");
  cacheTag(`person-credits:${personId}`);
  try {
    const data = await tmdb.getPerson(personId);
    const cast = data.combined_credits?.cast ?? [];
    const crew = data.combined_credits?.crew ?? [];
    return {
      acted: dedupe(cast.filter((c) => !(c.character && SELF_ROLE.test(c.character))).map(toItem)),
      directed: dedupe(crew.filter((c) => c.job && DIRECTOR_JOBS.has(c.job)).map(toItem)),
      wrote: dedupe(crew.filter((c) => c.job && WRITER_JOBS.has(c.job)).map(toItem)),
    };
  } catch {
    return { acted: [], directed: [], wrote: [] };
  }
}

// ---------------------------------------------------------------------------
// Franchises / collections
// ---------------------------------------------------------------------------

/** Every movie in a TMDB collection, oldest first. Cached. */
export async function collectionItems(collectionId: number): Promise<CompletionItem[]> {
  "use cache";
  cacheLife("days");
  cacheTag(`collection:${collectionId}`);
  try {
    const col = await tmdb.collection(collectionId);
    return dedupe(
      (col.parts ?? [])
        .slice()
        .sort((a, b) => (a.release_date ?? "").localeCompare(b.release_date ?? ""))
        .map((p) => toItem({ ...p, media_type: "movie" })),
    );
  } catch {
    return [];
  }
}

export interface FranchiseProgress {
  collectionId: number;
  name: string;
  total: number;
  watched: number;
  remaining: CompletionItem[];
  seen: CompletionItem[];
}

export interface CompletedFranchise {
  collectionId: number;
  name: string;
  items: CompletionItem[];
}

/**
 * Franchises the user has started: their watched movies grouped by TMDB
 * collection, with per-collection progress. Returns in-progress (watched < all)
 * sorted closest-to-done, plus the names of any fully-completed franchises.
 */
export async function franchisesInProgress(
  userId: string,
): Promise<{ inProgress: FranchiseProgress[]; completed: CompletedFranchise[] }> {
  const ids = await watchedTitleIds(userId);
  if (ids.length === 0) return { inProgress: [], completed: [] };

  const movieRows = await db
    .select({ tmdbId: titles.tmdbId, metadata: titles.metadata })
    .from(titles)
    .where(and(inArray(titles.id, ids), eq(titles.mediaType, "movie")));

  // collectionId → { name, watched tmdb ids }
  const groups = new Map<number, { name: string; watched: Set<number> }>();
  for (const row of movieRows) {
    const col = ((row.metadata ?? {}) as TmdbTitleDetail).belongs_to_collection;
    if (!col?.id) continue;
    const g = groups.get(col.id) ?? { name: col.name ?? "Collection", watched: new Set() };
    g.watched.add(row.tmdbId);
    groups.set(col.id, g);
  }

  const inProgress: FranchiseProgress[] = [];
  const completed: CompletedFranchise[] = [];
  for (const [collectionId, g] of groups) {
    // Only count what's actually out, so an announced sequel can't keep a
    // finished franchise stuck "in progress".
    const items = releasedItems(await collectionItems(collectionId));
    if (items.length < 2) continue; // not really a franchise (or only one out yet)
    const watchedKeys = new Set([...g.watched].map((id) => `movie:${id}`));
    const { total, watched, remaining, seen } = progressFor(items, watchedKeys);
    if (watched === 0) continue;
    if (remaining.length === 0) completed.push({ collectionId, name: g.name, items: seen });
    else inProgress.push({ collectionId, name: g.name, total, watched, remaining, seen });
  }
  inProgress.sort((a, b) => a.remaining.length - b.remaining.length || b.watched - a.watched);
  return { inProgress, completed };
}
