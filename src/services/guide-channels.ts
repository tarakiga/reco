import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { guideChannels } from "@/db/schema";

/** All of a user's saved guide channel picks, keyed by source/region. */
export async function getGuideChannels(userId: string): Promise<Record<string, string[]>> {
  const rows = await db
    .select({ country: guideChannels.country, channels: guideChannels.channels })
    .from(guideChannels)
    .where(eq(guideChannels.userId, userId));
  const map: Record<string, string[]> = {};
  for (const r of rows) map[r.country] = r.channels ?? [];
  return map;
}

/** Upsert a user's channel picks for one source/region. */
export async function setGuideChannels(userId: string, country: string, channels: string[]) {
  await db
    .insert(guideChannels)
    .values({ userId, country, channels })
    .onConflictDoUpdate({
      target: [guideChannels.userId, guideChannels.country],
      set: { channels, updatedAt: new Date() },
    });
}
