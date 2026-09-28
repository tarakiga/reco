import "server-only";

/** Wikidata's user-agent policy wants a real identifier plus a contact URL.
 *  Requests are throttled per user-agent, so this must stay accurate. */
const WD_HEADERS = {
  "User-Agent": "haystackk/1.0 (https://haystackk.com)",
  Accept: "application/sparql-results+json",
};

/** query.wikidata.org throttles hard and allows queries to run up to 60s server
 *  side. Without a client deadline a throttled request keeps the function alive
 *  and billing, so cap it below any function timeout. The cap must exceed the
 *  queries' honest latency: the location and related queries measure 2.5s to 6s
 *  from an unthrottled connection, and the original 5s cap made nearly every
 *  production call time out, which emptied all the Wikidata panels. The 20s cap
 *  that replaced it was safe but expensive: a month of production logs showed
 *  throttled requests hang to whatever cap is set, ~900 times a day, and every
 *  one of those held a function for the full 20s. 8s keeps 2s of headroom over
 *  the slowest measured query while capping what a throttled call can bill. */
const TIMEOUT_MS = 8_000;

/** Circuit breaker over all Wikidata calls. Post-fix logs still showed ~3
 *  failed probes a minute: a crawler walking distinct cold pages defeats
 *  per-entry negative caching (a crawler never revisits), so each new page
 *  still paid one full-timeout probe. The breaker counts failures in a
 *  SLIDING WINDOW, not consecutively: Wikidata's throttling is probabilistic,
 *  so occasional successes interleave with the failures, and a consecutive
 *  counter (the first version of this breaker) was reset by every one of them
 *  and never tripped in production. BREAKER_THRESHOLD failures inside
 *  BREAKER_WINDOW_MS open the breaker for BREAKER_OPEN_MS, during which
 *  sparql() returns null instantly; the first call after that window is the
 *  half-open probe, one success closes the breaker, another failure reopens
 *  it. Module state persists across requests on Fluid Compute because
 *  instances are reused; each instance keeps its own breaker. */
const BREAKER_THRESHOLD = 5;
const BREAKER_WINDOW_MS = 5 * 60_000;
const BREAKER_OPEN_MS = 10 * 60_000;

interface Breaker {
  /** Timestamps of recent failures; pruned to the window. */
  failures: number[];
  openUntil: number;
  /** True from the moment the open window lapses until the half-open probe
   *  resolves, so a failed probe reopens immediately without needing the
   *  window to refill. */
  halfOpen: boolean;
}

const breaker: Breaker = { failures: [], openUntil: 0, halfOpen: false };

/** Test hook: the breaker is module state shared across calls. */
export function resetWikidataBreaker(): void {
  breaker.failures = [];
  breaker.openUntil = 0;
  breaker.halfOpen = false;
}

function open(reason: string): void {
  breaker.openUntil = Date.now() + BREAKER_OPEN_MS;
  breaker.halfOpen = false;
  breaker.failures = [];
  console.warn(`[wikidata] breaker open for ${BREAKER_OPEN_MS / 60_000} minutes: ${reason}`);
}

function recordFailure(): void {
  if (breaker.halfOpen) {
    open("half-open probe failed");
    return;
  }
  const now = Date.now();
  breaker.failures = breaker.failures.filter((t) => now - t < BREAKER_WINDOW_MS);
  breaker.failures.push(now);
  if (breaker.failures.length >= BREAKER_THRESHOLD) {
    open(`${breaker.failures.length} failures in ${BREAKER_WINDOW_MS / 60_000} minutes`);
  }
}

function recordSuccess(): void {
  // Full reset: openUntil must return to 0, or the lapsed-window check in
  // sparql() would keep re-arming half-open and a single later blip would
  // reopen the breaker on its own.
  breaker.halfOpen = false;
  breaker.openUntil = 0;
}

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
  // Open breaker: skip the call entirely, and skip per-call logging too, since
  // the point is to stop paying (in held time and in log volume) for an
  // upstream that has already told us its answer repeatedly.
  if (Date.now() < breaker.openUntil) return null;
  if (breaker.openUntil !== 0 && !breaker.halfOpen) breaker.halfOpen = true;

  try {
    const res = await fetch(
      `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`,
      { headers: WD_HEADERS, signal: AbortSignal.timeout(TIMEOUT_MS) },
    );
    if (!res.ok) {
      // 429 and 403 are the throttling signals worth watching for.
      console.warn(`[wikidata] ${label} failed: HTTP ${res.status}`);
      recordFailure();
      return null;
    }
    const json = (await res.json()) as { results?: { bindings?: T[] } };
    recordSuccess();
    return json.results?.bindings ?? [];
  } catch (err) {
    const reason = err instanceof Error ? err.name : "unknown";
    console.warn(`[wikidata] ${label} failed: ${reason === "TimeoutError" ? `timeout after ${TIMEOUT_MS}ms` : reason}`);
    recordFailure();
    return null;
  }
}
