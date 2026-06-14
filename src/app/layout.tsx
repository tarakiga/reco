import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Suspense } from "react";
import { ClerkProvider, Show, SignInButton, UserButton } from "@clerk/nextjs";
import { PageShell } from "@/components/layout/PageShell";
import { NavigationProgress } from "@/components/layout/NavigationProgress";
import { ToastProvider } from "@/components/ui/Toast";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { BRAND_NAME, BRAND_TAGLINE, SITE_URL } from "@/lib/brand";
import { getBrandName, getNavLinks } from "@/services/site-config";

const footerAttribution = (
  <div className="space-y-1">
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
  </div>
);

const headerSearch = (
  <form action="/search" method="get" className="flex w-full max-w-sm items-center gap-2">
    <input
      name="q"
      type="search"
      aria-label="Search"
      placeholder="Search movies &amp; shows…"
      className="h-9 w-full rounded-md border border-border bg-surface-raised px-3 text-sm text-text placeholder:text-text-muted focus:outline-2 focus:outline-accent"
    />
    <button
      type="submit"
      className="h-9 rounded-md bg-accent px-3 text-sm font-medium text-white hover:bg-accent/90"
    >
      Search
    </button>
  </form>
);

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: BRAND_NAME,
    template: `%s — ${BRAND_NAME}`,
  },
  description: `${BRAND_TAGLINE} Search, discover, and track movies and TV shows.`,
  openGraph: {
    siteName: BRAND_NAME,
    type: "website",
    title: BRAND_NAME,
    description: `${BRAND_TAGLINE} Search, discover, and track movies and TV shows.`,
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const brand = await getBrandName();
  const navLinks = await getNavLinks();
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
          <ToastProvider>
            <QueryProvider>
            <Suspense>
              <NavigationProgress />
            </Suspense>
            <Suspense>
              <PageShell
                brand={brand}
                navLinks={navLinks}
                search={headerSearch}
                footer={footerAttribution}
                actions={
                  <>
                    <Show when="signed-out">
                      <SignInButton mode="modal" />
                    </Show>
                    <Show when="signed-in">
                      <UserButton>
                        <UserButton.MenuItems>
                          <UserButton.Link
                            label="Account"
                            labelIcon={<span aria-hidden>👤</span>}
                            href="/account"
                          />
                        </UserButton.MenuItems>
                      </UserButton>
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
