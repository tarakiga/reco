export const MATCH_RAMP_LOW = 0.2;
export const MATCH_RAMP_HIGH = 0.8;

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

/** Map cosine similarity to a 0-100 display match via a calibrated linear ramp. */
export function matchPercent(cos: number): number {
  const t = (cos - MATCH_RAMP_LOW) / (MATCH_RAMP_HIGH - MATCH_RAMP_LOW);
  return Math.round(Math.min(1, Math.max(0, t)) * 100);
}
