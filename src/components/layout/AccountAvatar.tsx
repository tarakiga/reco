"use client";
import { useUser } from "@clerk/nextjs";

/** Header avatar — a signed-in indicator. Account lives in the primary nav now,
 *  so this is no longer a link (was redundant). */
export function AccountAvatar() {
  const { user } = useUser();
  const initial = (user?.username ?? user?.firstName ?? "?").charAt(0).toUpperCase();

  return (
    <span
      aria-label="Signed in"
      className="inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-border bg-surface-raised text-sm font-medium text-text-muted"
    >
      {user?.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.imageUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        initial
      )}
    </span>
  );
}
