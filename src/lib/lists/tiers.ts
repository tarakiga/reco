// Tier-list support for shareable lists. Pure data/helpers shared by the schema
// validation, the editor, and the public page.

export const TIERS = ["S", "A", "B", "C"] as const;
export type Tier = (typeof TIERS)[number];

export function isTier(v: unknown): v is Tier {
  return typeof v === "string" && (TIERS as readonly string[]).includes(v);
}

/** Sort rank: S=0 … C=3, unranked last. */
export function tierRank(t: Tier | null | undefined): number {
  return t && isTier(t) ? TIERS.indexOf(t) : TIERS.length;
}

/**
 * TierMaker-style colours: S red, A orange, B yellow, C green. Used as a light
 * band background with black text, like a tier-list board. The Unranked bucket
 * uses a neutral slate that fits the dark theme.
 */
export const TIER_COLOR: Record<Tier, string> = {
  S: "#ff7f7f",
  A: "#ffbf7f",
  B: "#ffff7f",
  C: "#7fff7f",
};
export const UNRANKED_COLOR = "#39414f";

/** Colour for a tier band (or the Unranked bucket when null). */
export function tierColor(t: Tier | null): string {
  return t && isTier(t) ? TIER_COLOR[t] : UNRANKED_COLOR;
}
