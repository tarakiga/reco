import "server-only";
import type { Profile } from "@/db/schema";
import { hasRole, type Role } from "@/lib/roles";
import { getCurrentProfile } from "./profile";

export class AuthzError extends Error {
  constructor(public readonly status: 401 | 403, message: string) {
    super(message);
  }
}

/** Returns the current profile if it meets the minimum role; throws AuthzError otherwise. */
export async function requireRole(minimum: Role): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) throw new AuthzError(401, "Sign in required");
  if (!hasRole(profile.role, minimum)) throw new AuthzError(403, `Requires ${minimum} role`);
  return profile;
}
