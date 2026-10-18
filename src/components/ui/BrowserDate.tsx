"use client";

import { useSyncExternalStore } from "react";
import { localTodayYmd } from "@/lib/today";

const subscribe = () => () => {};
const getSnapshot = () => localTodayYmd();
const getServerSnapshot = () => null;

/**
 * The browser-local date (YYYY-MM-DD): `null` on the server and during
 * hydration, the real date after mount. Render anything date-dependent only
 * once this is non-null, so the prerendered HTML and the first client render
 * always match.
 */
export function useBrowserToday(): string | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
