import type { Metadata } from "next";
import Link from "next/link";
import { Asap, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Suspense } from "react";
import { ClerkProvider, Show, SignInButton } from "@clerk/nextjs";
import { PageShell } from "@/components/layout/PageShell";
import { AdLoader } from "@/components/ads/AdLoader";
import { AdSlot } from "@/components/ads/AdSlot";
import { AccountAvatar } from "@/components/layout/AccountAvatar";
import { NavigationProgress } from "@/components/layout/NavigationProgress";
import { ToastProvider } from "@/components/ui/Toast";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { BRAND_NAME, BRAND_TAGLINE, SITE_URL } from "@/lib/brand";
import { getBrandName, getNavLinks } from "@/services/site-config";
import { SearchAutocomplete } from "@/components/layout/SearchAutocomplete";
import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";
import { ConsentBanner } from "@/components/analytics/ConsentBanner";

const footerAttribution = (
  <div className="space-y-1">
    <p>
      Questions or feedback?{" "}
      <a href="mailto:hello@haystackk.com" className="underline hover:text-text">
        hello@haystackk.com
      </a>
    </p>
    <p>
      This product uses the{" "}
      <a
        href="https://www.themoviedb.org"
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:text-text"
      >
        TMDB API
      </a>{" "}
      but is not endorsed or certified by TMDB.
    </p>
    <p>Streaming data powered by JustWatch.</p>
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1">
      <Link href="/privacy" className="underline hover:text-text">
        Privacy policy
      </Link>
      <span aria-hidden>·</span>
      <span>
        Created by{" "}
        <a
          href="https://virtumultimedia.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-text"
        >
          VirtuMultimedia
        </a>
      </span>
    </p>
  </div>
);

const headerSearch = <SearchAutocomplete />;

const asap = Asap({ variable: "--font-asap", subsets: ["latin"], display: "swap" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: BRAND_NAME,
    template: `%s · ${BRAND_NAME}`,
  },
  description: `${BRAND_TAGLINE} Search, discover, and track movies and TV shows.`,
  openGraph: {
    siteName: BRAND_NAME,
    type: "website",
    title: BRAND_NAME,
    description: `${BRAND_TAGLINE} Search, discover, and track movies and TV shows.`,
    images: [{ url: "/og", width: 1200, height: 630, alt: BRAND_NAME }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og"],
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const brand = await getBrandName();
  const navLinks = await getNavLinks();
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={`${asap.variable} ${geistMono.variable} overflow-x-clip antialiased`}>
          <GoogleAnalytics />
          <ConsentBanner />
          <ToastProvider>
            <QueryProvider>
            <Suspense>
              <AdLoader />
            </Suspense>
            <Suspense>
              <NavigationProgress />
            </Suspense>
            <Suspense>
              <PageShell
                brand={brand}
                navLinks={navLinks}
                search={headerSearch}
                footer={
                  <>
                    <AdSlot placement="footer" className="mb-5" />
                    {footerAttribution}
                  </>
                }
                actions={
                  <>
                    <Show when="signed-out">
                      <SignInButton mode="modal" />
                    </Show>
                    <Show when="signed-in">
                      <AccountAvatar />
                    </Show>
                  </>
                }
              >
                {children}
              </PageShell>
            </Suspense>
            </QueryProvider>
          </ToastProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
