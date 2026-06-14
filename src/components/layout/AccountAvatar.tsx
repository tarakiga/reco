"use client";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";

/** Header avatar that links straight to the account hub (no popover menu). */
export function AccountAvatar() {
  const { user } = useUser();
  const initial = (user?.username ?? user?.firstName ?? "?").charAt(0).toUpperCase();

  return (
    <Link
      href="/account"
      aria-label="Your account"
      className="inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-border bg-surface-raised text-sm font-medium text-text-muted transition hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {user?.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.imageUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        initial
      )}
    </Link>
  );
}
