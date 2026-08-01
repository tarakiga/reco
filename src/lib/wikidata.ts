import "server-only";

/** Wikidata's user-agent policy wants a real identifier plus a contact URL.
 *  Requests are throttled per user-agent, so this must stay accurate. */
const WD_HEADERS = {
  "User-Agent": "haystackk/1.0 (https://haystackk.com)",
  Accept: "application/sparql-results+json",
};

/** query.wikidata.org throttles hard and allows queries to run up to 60s server
 *  side. Without a client deadline a throttled request keeps the function alive
 *  and billing, so cap it well below any function timeout. */
const TIMEOUT_MS = 5_000;

export type SparqlBinding = Record<string, { value: string } | undefined>;

/**
 * Run a SPARQL query and return its bindings, or null on any failure.
 *
 * Callers treat null as "no data" and degrade quietly, which is right for a
 * supplementary panel. The logging is the point: these calls previously
 * swallowed every failure silently, so Wikidata throttling was invisible in
 * production and looked identical to a title simply having no awards.
 */
export async function sparql<T extends SparqlBinding>(
  query: string,
  label: string,
): Promise<T[] | null> {
  try {
    const res = await fetch(
      `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`,
      { headers: WD_HEADERS, signal: AbortSignal.timeout(TIMEOUT_MS) },
    );
    if (!res.ok) {
      // 429 and 403 are the throttling signals worth watching for.
      console.warn(`[wikidata] ${label} failed: HTTP ${res.status}`);
      return null;
    }
    const json = (await res.json()) as { results?: { bindings?: T[] } };
    return json.results?.bindings ?? [];
  } catch (err) {
    const reason = err instanceof Error ? err.name : "unknown";
    console.warn(`[wikidata] ${label} failed: ${reason === "TimeoutError" ? `timeout after ${TIMEOUT_MS}ms` : reason}`);
    return null;
  }
}
