import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { clerkMiddleware } from "@clerk/nextjs/server";
import { canonicalRedirectUrl, productionHost } from "@/lib/canonical-host";
import { isBlockedAgent } from "@/lib/blocked-agents";

const clerk = clerkMiddleware();

export default function proxy(req: NextRequest, event: NextFetchEvent) {
  // Refused crawlers first: this is the cheapest exit in the request path, and
  // it keeps them off the RSC segment fan-out and off the /find vector search.
  if (isBlockedAgent(req.headers.get("user-agent"))) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // Canonical-host check next, so a redirected request never pays for Clerk.
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
