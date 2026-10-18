import type { NextConfig } from "next";

/** Next's config `Redirect` type, which the public "next" entry does not name. */
export type Redirect = Awaited<ReturnType<NonNullable<NextConfig["redirects"]>>>[number];

/**
 * Every Vercel project keeps its auto-generated *.vercel.app hosts alongside the
 * custom domain, and each one serves a full copy of the site: duplicate content
 * for crawlers, and a host where Clerk (configured for the custom domain) cannot
 * sign anyone in. Production traffic on those hosts is sent to the production
 * host by a platform redirect, so it costs no function invocation and covers the
 * routes the proxy no longer runs on.
 */

export interface CanonicalEnv {
  VERCEL_ENV?: string;
  /** The production host Vercel resolved for this project, set at build time too. */
  VERCEL_PROJECT_PRODUCTION_URL?: string;
  /** Lets `process.env` be passed whole. */
  [name: string]: string | undefined;
}

/** The redirects for `next.config.ts`: none outside production deployments. */
export function canonicalRedirects(env: CanonicalEnv): Redirect[] {
  // Previews and local dev are addressed by their own hosts, on purpose.
  const host = env.VERCEL_PROJECT_PRODUCTION_URL;
  if (env.VERCEL_ENV !== "production" || !host) return [];
  // A project with no custom domain has a *.vercel.app production host. The
  // host condition below would then match the destination too and loop.
  if (/\.vercel\.app$/i.test(host)) return [];
  return [
    {
      // Every path except /api and /api/*. Machine callers keep whichever host
      // they dialled: Vercel Cron calls /api/cron/* with an Authorization
      // header, and a cross-host redirect is allowed to drop that header, which
      // would turn the job into a silent 401. Next keeps the query string.
      source: "/:path((?!api(?:/|$)).*)",
      // Any host ending in .vercel.app, never the production host itself.
      has: [{ type: "host", value: "^.+\\.vercel\\.app$" }],
      destination: `https://${host}/:path`,
      permanent: true,
    },
  ];
}
