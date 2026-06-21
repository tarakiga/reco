import "server-only";
import { publishedOptions } from "./public-config";
import { ADS_NAMESPACE, ADS_ENABLED_KEY, ADS_LOADER_KEY, AD_PLACEMENTS, slotKey, type AdsConfig } from "@/lib/ads";

/**
 * Resolved ads config from the published "ads" config namespace.
 *
 * `publishedOptions` already drops disabled options and is cache-tagged
 * (`config:options_namespace:ads`), so this revalidates automatically when an
 * admin publishes in /admin/ads. The master switch must be explicitly true, and
 * a slot resolves to null unless it has a non-empty snippet — that's the
 * "ships dark, flip on later" guarantee.
 */
export async function getAdsConfig(): Promise<AdsConfig> {
  const opts = await publishedOptions(ADS_NAMESPACE);
  const get = (key: string) => opts.find((o) => o.key === key)?.value;
  const str = (key: string): string | null => {
    const v = get(key);
    return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
  };
  const en = get(ADS_ENABLED_KEY);
  const enabled = en === true || en === "on" || en === "true";

  const slots: Record<string, string | null> = {};
  for (const p of AD_PLACEMENTS) slots[p.key] = str(slotKey(p.key));

  return { enabled, loader: str(ADS_LOADER_KEY), slots };
}

/** The ad-unit HTML for a placement, or null when ads are off or it's unset. */
export async function adSnippet(placement: string): Promise<string | null> {
  const cfg = await getAdsConfig();
  if (!cfg.enabled) return null;
  return cfg.slots[placement] ?? null;
}
