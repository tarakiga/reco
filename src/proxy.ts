import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { clerkMiddleware } from "@clerk/nextjs/server";
import { canonicalRedirectUrl, productionHost } from "@/lib/canonical-host";

const clerk = clerkMiddleware();

export default function proxy(req: NextRequest, event: NextFetchEvent) {
  // Canonical-host check first, so a redirected request never pays for Clerk.
  const target = canonicalRedirectUrl({
    host: req.headers.get("host"),
    pathname: req.nextUrl.pathname,
    search: req.nextUrl.search,
    canonicalHost: productionHost(),
    isProduction: process.env.VERCEL_ENV === "production",
  });
  if (target) return NextResponse.redirect(target, 308);

  return clerk(req, event);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
