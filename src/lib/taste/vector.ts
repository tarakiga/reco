export const RATING_WEIGHTS: Record<number, number> = {
  5: 1.0,
  4: 0.5,
  3: 0.1,
  2: -0.5,
  1: -1.0,
};
export const STATUS_WEIGHTS: Record<string, number> = {
  watched: 0.3,
  watching: 0.2,
  want_to_watch: 0.15,
};

/** A rating wins over watchlist status when both exist. */
export function signalWeight(signal: { score?: number; status?: string }): number {
  if (signal.score != null) return RATING_WEIGHTS[signal.score] ?? 0;
  if (signal.status) return STATUS_WEIGHTS[signal.status] ?? 0;
  return 0;
}

export interface WeightedEmbedding {
  weight: number;
  embedding: number[];
}

/** L2-normalized weighted sum of embeddings; null when there's no usable signal. */
export function tasteCentroid(items: WeightedEmbedding[]): number[] | null {
  if (items.length === 0) return null;
  const dim = items[0].embedding.length;
  const acc = new Array(dim).fill(0);
  for (const { weight, embedding } of items) {
    for (let i = 0; i < dim; i++) acc[i] += weight * embedding[i];
  }
  const norm = Math.hypot(...acc);
  if (norm === 0) return null;
  return acc.map((x) => x / norm);
}
