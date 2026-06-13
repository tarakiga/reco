export type Rgb = [number, number, number];

/** Neutral fallback (matches --color-surface-overlay) when no color can be derived. */
export const FALLBACK_RGB: Rgb = [29, 33, 48];

/**
 * Pick a representative, vivid-leaning dominant color from raw RGBA pixel data
 * (e.g. a small canvas drawn from a poster). Pixels are quantized into coarse
 * buckets and weighted by saturation × brightness so a poster's signature hue
 * wins over muddy averages and large flat black/white regions.
 */
export function dominantColor(data: Uint8ClampedArray): Rgb {
  const buckets = new Map<number, { r: number; g: number; b: number; w: number }>();
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a < 125) continue;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    const val = max / 255;
    // Weight vivid, mid-bright pixels highest; flat black/white contribute little.
    const weight = 0.1 + sat * 1.6 * val;
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bk = buckets.get(key) ?? { r: 0, g: 0, b: 0, w: 0 };
    bk.r += r * weight;
    bk.g += g * weight;
    bk.b += b * weight;
    bk.w += weight;
    buckets.set(key, bk);
  }
  let best: { r: number; g: number; b: number; w: number } | null = null;
  for (const bk of buckets.values()) {
    if (!best || bk.w > best.w) best = bk;
  }
  if (!best || best.w === 0) return FALLBACK_RGB;
  return [
    Math.round(best.r / best.w),
    Math.round(best.g / best.w),
    Math.round(best.b / best.w),
  ];
}

/** CSS rgb()/rgba() string for a color, optional alpha 0..1. */
export function rgba([r, g, b]: Rgb, alpha = 1): string {
  return alpha >= 1 ? `rgb(${r} ${g} ${b})` : `rgb(${r} ${g} ${b} / ${alpha})`;
}
