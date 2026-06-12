import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles, type Profile } from "@/db/schema";
import { usernameBase } from "@/lib/username";

/** Idempotently get-or-create the local profile row for a Clerk user. */
export async function ensureProfile(
  clerkUserId: string,
  emailOrName: string,
): Promise<Profile> {
  const existing = await db.query.profiles.findFirst({
    where: eq(profiles.clerkUserId, clerkUserId),
  });
  if (existing) return existing;

  const base = usernameBase(emailOrName);
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base}${i}`;
    try {
      const [row] = await db
        .insert(profiles)
        .values({ clerkUserId, username: candidate })
        .returning();
      return row;
    } catch {
      // Unique violation: either username taken (try next suffix) or a
      // concurrent request already created this user's profile.
      const again = await db.query.profiles.findFirst({
        where: eq(profiles.clerkUserId, clerkUserId),
      });
      if (again) return again;
    }
  }
  throw new Error(`Could not allocate a username for ${clerkUserId}`);
}

/** Current request's profile, or null when signed out. */
export async function getCurrentProfile(): Promise<Profile | null> {
  const { userId } = await auth();
  if (!userId) return null;
  const user = await currentUser();
  const seed =
    user?.primaryEmailAddress?.emailAddress ?? user?.username ?? userId;
  return ensureProfile(userId, seed);
}
