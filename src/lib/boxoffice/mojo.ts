const MOJO_WEEKEND_URL = "https://www.boxofficemojo.com/weekend/";
// A real browser UA — Box Office Mojo serves the chart fine to this and 403s
// some default client agents.
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#0?34;/g, '"');
}

/**
 * The current US #1 release at the box office, scraped from Box Office Mojo's
 * weekend index. The index lists weekends newest-first, and future weekends
 * carry no release link yet, so the first `/release/` anchor is always the most
 * recent weekend's #1.
 *
 * TMDB exposes no real box-office figures (its `popularity` is an engagement
 * score, not ticket sales), so this is the only source for the genuine leader.
 * Returns null on any failure (network, block, or layout change) so callers can
 * fall back to a popularity-ranked title rather than break the hero.
 */
export async function boxOfficeNumberOneTitle(): Promise<string | null> {
  try {
    const res = await fetch(MOJO_WEEKEND_URL, {
      headers: { "user-agent": BROWSER_UA, accept: "text/html" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const m = html.match(/href="\/release\/[a-z0-9]+\/[^"]*"[^>]*>([^<]+)<\/a>/i);
    if (!m) return null;
    const title = decodeEntities(m[1]).trim();
    return title || null;
  } catch {
    return null;
  }
}
