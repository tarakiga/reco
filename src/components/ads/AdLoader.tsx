import Script from "next/script";
import { getAdsConfig } from "@/services/ads";

/**
 * Injects the ad-network loader script once, site-wide, when ads are enabled and
 * a loader URL is configured. Rendered in the root layout. Renders nothing until
 * activated, so it adds no requests to the site by default.
 */
export async function AdLoader() {
  const cfg = await getAdsConfig();
  if (!cfg.enabled || !cfg.loader) return null;
  return <Script src={cfg.loader} strategy="afterInteractive" crossOrigin="anonymous" />;
}
