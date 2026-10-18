"use client";
import { useAuth } from "@clerk/nextjs";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

/**
 * Drops every cached query when the signed-in account changes. Clerk sign-in
 * and sign-out are soft navigations, so the QueryClient outlives them; without
 * this, the next account could read the previous account's cached data.
 *
 * "Not loaded yet" counts as unknown: the first known value (signed in or out)
 * is only recorded, never cleared on. Any later change between known values,
 * including to signed out (null), clears the cache.
 *
 * Rendered as the first child of the provider so its effect runs before the
 * effects of the page below it: queries the page builds for the new account
 * are then created after the clear and stay attached to the cache.
 */
function ClearOnAccountChange() {
  const { isLoaded, userId } = useAuth();
  const client = useQueryClient();
  const previous = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (!isLoaded || userId === undefined) return;
    const current = userId ?? null;
    if (previous.current !== undefined && previous.current !== current) client.clear();
    previous.current = current;
  }, [client, isLoaded, userId]);

  return null;
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <ClearOnAccountChange />
      {children}
    </QueryClientProvider>
  );
}
