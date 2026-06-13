"use client";
import { useEffect, useState } from "react";
import { dominantColor, type Rgb } from "@/lib/color";

/**
 * Client-side: load `src` cross-origin, draw a 32×32 thumbnail to a canvas, and
 * derive a representative dominant color. Returns null until ready (callers fall
 * back to a neutral tint). TMDB images send `Access-Control-Allow-Origin: *`, so
 * the canvas is readable; any taint/decode error is swallowed and leaves null.
 */
export function useDominantColor(src: string | null | undefined): Rgb | null {
  // Keyed by src so a stale color never shows for a newly-changed image
  // (avoids a synchronous reset setState inside the effect).
  const [resolved, setResolved] = useState<{ src: string; rgb: Rgb } | null>(null);

  useEffect(() => {
    if (!src) return;
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      try {
        const size = 32;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);
        if (!cancelled) setResolved({ src, rgb: dominantColor(data) });
      } catch {
        // tainted canvas or decode failure — keep the neutral fallback
      }
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  return resolved && resolved.src === src ? resolved.rgb : null;
}
