import Script from "next/script";

// GA4 Measurement ID. Public by design (it ships in the client HTML on every
// page), so it's safe to commit. An env var override wins if ever set.
const GA_ID = process.env.NEXT_PUBLIC_GA_ID || "G-PFP32LMLWD";

/**
 * Google Analytics 4 (gtag.js) with Consent Mode v2. Loaded on deployed builds
 * only (skipped in local development). Consent defaults to DENIED, so until the
 * visitor accepts via the banner, GA runs cookieless and stores nothing on the
 * device; ConsentBanner flips analytics_storage to "granted" on accept.
 */
export function GoogleAnalytics() {
  if (!GA_ID || process.env.NODE_ENV !== "production") return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="ga-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',wait_for_update:500});gtag('js',new Date());gtag('config','${GA_ID}');`}
      </Script>
    </>
  );
}
