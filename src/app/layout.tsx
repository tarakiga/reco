import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Suspense } from "react";
import { ClerkProvider, Show, SignInButton, UserButton } from "@clerk/nextjs";
import { PageShell } from "@/components/layout/PageShell";
import { ToastProvider } from "@/components/ui/Toast";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { BRAND_NAME } from "@/lib/brand";
import { NAV_LINKS } from "@/lib/nav";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: BRAND_NAME,
  description: "Find what to watch.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
          <ToastProvider>
            <QueryProvider>
            <Suspense>
              <PageShell
                brand={BRAND_NAME}
                navLinks={NAV_LINKS}
                actions={
                  <>
                    <Show when="signed-out">
                      <SignInButton mode="modal" />
                    </Show>
                    <Show when="signed-in">
                      <UserButton />
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
