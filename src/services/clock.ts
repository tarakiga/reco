import "server-only";
import { cacheLife } from "next/cache";

/**
 * The server's UTC date as YYYY-MM-DD, cached for about an hour so pages that
 * use it stay static. Coarse values only (facts panel, "in theaters", seasonal
 * moods); anything a visitor reads as "today" must use the browser's date.
 */
export async function cachedTodayYmd(): Promise<string> {
  "use cache";
  cacheLife("hours");
  return new Date().toISOString().slice(0, 10);
}
