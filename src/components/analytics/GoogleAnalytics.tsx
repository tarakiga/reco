import Script from "next/script";

/**
 * Google Analytics 4 (gtag.js). Renders nothing unless NEXT_PUBLIC_GA_ID is set,
 * so it ships dark and switches on the moment the env var is configured (and the
 * site is redeployed). The Measurement ID (G-XXXXXXXXXX) is public by design.
 */
export function GoogleAnalytics() {
  const id = process.env.NEXT_PUBLIC_GA_ID;
  if (!id) return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" />
      <Script id="ga-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}');`}
      </Script>
    </>
  );
}
