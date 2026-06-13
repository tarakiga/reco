// Fallback default used by site-config.ts when the config system has no published brand/nav (build-guide safe-default rule).
export const BRAND_NAME = "reco";

export const BRAND_TAGLINE = "Find what to watch.";

// Canonical site origin for absolute metadata/OG URLs. Prefers the Vercel-provided
// production URL, falls back to the known production domain.
export const SITE_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "https://reco-pink.vercel.app";
