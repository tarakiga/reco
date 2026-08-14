/**
 * Self-declared crawlers that are refused at the edge of the app.
 *
 * Lightpanda is a headless-browser scraper that ignores robots.txt. On
 * 2026-08-14 it walked the catalog from a spread of residential ISPs at roughly
 * 218 req/s, and because each title page fans out into four RSC segment
 * requests, it multiplied straight into function duration and into the Voyage
 * and Neon spend behind /find.
 *
 * A Vercel WAF rule blocks this before any function runs and is the cheaper
 * place to do it. This list is the backstop that travels with the code, and it
 * only catches agents that name themselves, so it stops working the moment one
 * decides to lie.
 */
const BLOCKED = [/\bLightpanda\b/i];

export function isBlockedAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  return BLOCKED.some((re) => re.test(userAgent));
}
