import type { TmdbTitleDetail } from "@/lib/tmdb/types";
import { WhereToWatchView } from "./WhereToWatchView";

/**
 * Server component wrapper — passes a static region (defaults to "US").
 * For user-personalised region, use WhereToWatchClient instead.
 */
export function WhereToWatch({
  watch,
  region = "US",
}: {
  watch: TmdbTitleDetail["watch/providers"] | undefined;
  region?: string;
}) {
  return <WhereToWatchView watch={watch} region={region} />;
}
