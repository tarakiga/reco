"use client";
import { useClerk, useUser } from "@clerk/nextjs";

export function AccountHeader({ username, memberSince }: { username: string; memberSince: string }) {
  const { user } = useUser();
  const clerk = useClerk();

  return (
    <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
      {user?.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.imageUrl} alt="" className="h-16 w-16 rounded-full border border-border object-cover" />
      ) : (
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-border bg-surface-raised text-2xl text-text-muted">
          {username.charAt(0).toUpperCase()}
        </div>
      )}
      <div>
        <h1 className="text-2xl font-bold text-text">{user?.fullName || username}</h1>
        <p className="text-sm text-text-muted">
          @{username} · Member since {memberSince}
        </p>
        <button
          type="button"
          onClick={() => clerk.openUserProfile()}
          className="mt-2 inline-flex h-9 items-center justify-center rounded-md border border-border bg-surface-raised px-4 text-sm font-medium text-text transition-colors hover:bg-surface-overlay focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Manage account
        </button>
      </div>
    </div>
  );
}
