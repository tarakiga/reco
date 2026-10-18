import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { clerkMiddleware } from "@clerk/nextjs/server";
import { isBlockedAgent } from "@/lib/blocked-agents";

const clerk = clerkMiddleware();

export default function proxy(req: NextRequest, event: NextFetchEvent) {
  // Refused crawlers first: this is the cheapest exit in the request path, and
  // it keeps them off the API routes. The cached catalog routes are outside the
  // matcher, so a Vercel Firewall rule refuses the same agents there.
  if (isBlockedAgent(req.headers.get("user-agent"))) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // Non-canonical hosts are redirected by the platform (`redirects()` in
  // next.config.ts), before this runs.
  return clerk(req, event);
}

export const config = {
  matcher: [
    // Everything except: Next internals and static files; the cached catalog
    // routes, which read no user state on the server and so must not invoke a
    // function per request. Tier A: `/`, title and episode pages (with their og
    // routes), person, location, source, mood (with its tv tab), moods,
    // privacy, what-can-i-do, guide, shuffle, for-you, rank. Tier B: tv,
    // movies, find, search. Prefix entries end at a `/` or the end of the path;
    // exact entries allow only an optional trailing slash, so `/tvx` still runs.
    "/((?!$|_next|(?:title|person|location|source|mood)(?:/|$)|(?:moods|privacy|what-can-i-do|guide|shuffle|for-you|rank|tv|movies|find|search)/?$|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
