import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { tmdb } from "@/lib/tmdb/client";
import { sparql } from "@/lib/wikidata";

export interface AwardGroup {
  /** Awarding body, e.g. "Academy Award", "BAFTA Award", "Golden Globe Award". */
  body: string;
  /** Wins from this body. */
  count: number;
}
export interface PersonAwards {
  wins: number;
  nominations: number;
  /** Wins grouped by awarding body, most-won first. */
  groups: AwardGroup[];
}

/**
 * A person's awards from Wikidata (TMDB has none): P166 "award received" and
 * P1411 "nominated for". Cached per person; null on no-wikidata-id, error, or no
 * award data. Oscar/Emmy/Globe counts are by award-label keyword (same approach
 * as title awards).
 */
export async function personAwards(personId: number): Promise<PersonAwards | null> {
  "use cache";
  // Awards change at most a few times a year, so the default profile's ~15
  // minute revalidate was re-querying Wikidata far more than the data warrants.
  cacheLife("days");
  cacheTag(`person-awards:${personId}`);

  let wikidataId: string | null = null;
  try {
    wikidataId = (await tmdb.personExternalIds(personId)).wikidata_id ?? null;
  } catch {
    return null;
  }
  if (!wikidataId) return null;

  const query = `SELECT ?prop ?val ?valLabel WHERE {
    VALUES (?prop ?p) { ('award' wdt:P166) ('nominated' wdt:P1411) }
    wd:${wikidataId} ?p ?val.
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  }`;

  const bindings = await sparql<{
    prop?: { value: string };
    val?: { value: string };
    valLabel?: { value: string };
  }>(query, `person-awards:${personId}`);
  if (!bindings) return null;

  const wins: string[] = [];
  const noms: string[] = [];
  const seen: Record<string, Set<string>> = { award: new Set(), nominated: new Set() };
  for (const b of bindings) {
    const prop = b.prop?.value;
    const uri = b.val?.value;
    const label = b.valLabel?.value;
    if (!prop || !uri || !label || !seen[prop]) continue;
    const qid = uri.split("/").pop()!;
    if (seen[prop].has(qid)) continue;
    seen[prop].add(qid);
    (prop === "award" ? wins : noms).push(label);
  }

  if (wins.length === 0 && noms.length === 0) return null;

  // Group wins by awarding body: "Academy Award for Best Picture" → "Academy Award".
  const byBody = new Map<string, number>();
  for (const w of wins) {
    const body = w.split(/\s+for\s+/i)[0].trim();
    byBody.set(body, (byBody.get(body) ?? 0) + 1);
  }
  const groups = [...byBody.entries()]
    .map(([body, count]) => ({ body, count }))
    .sort((a, b) => b.count - a.count || a.body.localeCompare(b.body));

  return { wins: wins.length, nominations: noms.length, groups };
}
