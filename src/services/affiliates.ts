import "server-only";
import { publishedOptions } from "./public-config";
import type { AffiliateConfig } from "@/lib/affiliates";

/**
 * Resolved affiliate config from the published "affiliates" config namespace.
 *
 * `publishedOptions` already drops disabled options and is cache-tagged
 * (`config:options_namespace:affiliates`), so this revalidates automatically
 * when an admin publishes in /admin/affiliates. A field resolves to null unless
 * it is both enabled and has a non-empty string value — that's what gates the
 * frontend links ("only show when filled").
 */
export async function getAffiliates(): Promise<AffiliateConfig> {
  const opts = await publishedOptions("affiliates");
  const read = (key: string): string | null => {
    const v = opts.find((o) => o.key === key)?.value;
    return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
  };
  return {
    amazonTag: read("amazon"),
    appleToken: read("apple"),
    fandangoCode: read("fandango"),
    disclosure: read("disclosure"),
  };
}
