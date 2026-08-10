/**
 * Every Vercel project keeps its auto-generated *.vercel.app hosts alongside the
 * custom domain, and each one serves a full copy of the site: duplicate content
 * for crawlers, and a host where Clerk (configured for the custom domain) cannot
 * sign anyone in. Production traffic on any other host is sent to the canonical
 * one.
 */

export interface CanonicalInput {
  /** Request Host header. */
  host: string | null | undefined;
  pathname: string;
  /** Query string including the leading "?", or "" when there is none. */
  search: string;
  /** Host to canonicalise on. Null disables the redirect entirely. */
  canonicalHost: string | null | undefined;
  isProduction: boolean;
}

/** The absolute URL to redirect to, or null to serve the request as it came in. */
export function canonicalRedirectUrl(i: CanonicalInput): string | null {
  // Previews and local dev are addressed by their own hosts, on purpose.
  if (!i.isProduction || !i.canonicalHost) return null;
  if (!i.host || i.host === i.canonicalHost) return null;
  // Machine callers keep whichever host they dialled. Vercel Cron calls
  // /api/cron/* with an Authorization header, and a cross-host redirect is
  // allowed to drop that header, which would turn the job into a silent 401.
  if (i.pathname === "/api" || i.pathname.startsWith("/api/")) return null;
  return `https://${i.canonicalHost}${i.pathname}${i.search}`;
}

/** The production host Vercel resolved for this project (shortest custom domain),
 *  or null when it is not set, as in local dev. */
export function productionHost(): string | null {
  return process.env.VERCEL_PROJECT_PRODUCTION_URL || null;
}
