import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { notifyAlerts, titles } from "@/db/schema";
import { getOrCreateTitle } from "./catalog";

export async function addAlert(userId: string, mediaType: "movie" | "tv", tmdbId: number): Promise<void> {
  const t = await getOrCreateTitle(mediaType, tmdbId);
  await db.insert(notifyAlerts).values({ userId, titleId: t.id }).onConflictDoNothing();
}

export async function removeAlert(userId: string, mediaType: "movie" | "tv", tmdbId: number): Promise<void> {
  const t = await getOrCreateTitle(mediaType, tmdbId);
  await db.delete(notifyAlerts).where(and(eq(notifyAlerts.userId, userId), eq(notifyAlerts.titleId, t.id)));
}

export async function hasAlert(userId: string, mediaType: "movie" | "tv", tmdbId: number): Promise<boolean> {
  const t = await getOrCreateTitle(mediaType, tmdbId);
  const [row] = await db
    .select({ userId: notifyAlerts.userId })
    .from(notifyAlerts)
    .where(and(eq(notifyAlerts.userId, userId), eq(notifyAlerts.titleId, t.id)));
  return Boolean(row);
}

export interface AlertRow {
  userId: string;
  titleId: string;
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
}

/** All active alerts, joined to title info (for the notify cron). */
export async function listAllAlerts(): Promise<AlertRow[]> {
  const rows = await db
    .select({
      userId: notifyAlerts.userId,
      titleId: notifyAlerts.titleId,
      tmdbId: titles.tmdbId,
      mediaType: titles.mediaType,
      title: titles.title,
    })
    .from(notifyAlerts)
    .innerJoin(titles, eq(titles.id, notifyAlerts.titleId));
  return rows.map((r) => ({ ...r, tmdbId: Number(r.tmdbId) }));
}

/** Remove a single alert by its internal title id (used after firing). */
export async function clearAlert(userId: string, titleId: string): Promise<void> {
  await db.delete(notifyAlerts).where(and(eq(notifyAlerts.userId, userId), eq(notifyAlerts.titleId, titleId)));
}
