"use client";
import { Show, SignInButton } from "@clerk/nextjs";
import { AccountAvatar } from "./AccountAvatar";

/**
 * Signed-in state for the shared header, decided in the browser.
 *
 * Clerk's `Show` resolves to its server build when imported from a server
 * component, and that build calls `auth()`, which makes every route render per
 * request. In a "use client" file it resolves to the client build, so the
 * server output stays identical for everyone and the CDN can cache it.
 */
export function HeaderAuth() {
  return (
    // min-w keeps the slot at avatar width while Clerk loads, so the search
    // box does not jump when the button or avatar appears.
    <div className="flex min-h-8 min-w-8 items-center">
      <Show when="signed-out">
        <SignInButton mode="modal" />
      </Show>
      <Show when="signed-in">
        <AccountAvatar />
      </Show>
    </div>
  );
}

/** Renders children only for signed-in users, decided in the browser. */
export function SignedInOnly({ children }: { children: React.ReactNode }) {
  return <Show when="signed-in">{children}</Show>;
}
