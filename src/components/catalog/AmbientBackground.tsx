"use client";
import { useDominantColor } from "@/lib/useDominantColor";
import { rgba, FALLBACK_RGB } from "@/lib/color";

/**
 * Page-level ambient tint: samples the poster's dominant color client-side and
 * washes it across the top of the page background, fading into the base surface.
 * Fixed + behind all content (pointer-events-none, -z-10), so it colors the
 * whole page rather than just the hero. Falls back to a neutral tint until ready.
 */
export function AmbientBackground({ colorSrc }: { colorSrc: string | null }) {
  const rgb = useDominantColor(colorSrc) ?? FALLBACK_RGB;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 transition-[background] duration-700 ease-out"
      style={{
        background: `linear-gradient(to bottom, ${rgba(rgb, 0.55)} 0%, ${rgba(rgb, 0.2)} 28%, ${rgba(rgb, 0.05)} 48%, transparent 65%)`,
      }}
    />
  );
}
