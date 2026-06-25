import Script from "next/script";

// GA4 Measurement ID. Public by design (it ships in the client HTML on every
// page), so it's safe to commit. An env var override wins if ever set.
const GA_ID = process.env.NEXT_PUBLIC_GA_ID || "G-PFP32LMLWD";

/**
 * Google Analytics 4 (gtag.js). Loaded on deployed builds only — skipped in
 * local development so dev/test traffic never pollutes the analytics.
 */
export function GoogleAnalytics() {
  if (!GA_ID || process.env.NODE_ENV !== "production") return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="ga-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');`}
      </Script>
    </>
  );
}
