"use client";
import type { ReactNode } from "react";
import { useDominantColor } from "@/lib/useDominantColor";
import { rgba, FALLBACK_RGB } from "@/lib/color";

/**
 * Cinematic hero background: the title's backdrop image with a dynamic
 * dominant-color gradient (sampled client-side from the poster) tinting the top
 * and fading into the page surface at the bottom for text legibility.
 *
 * `children` (poster + title block) render above the backdrop layers.
 */
export function HeroBackdrop({
  backdropUrl,
  colorSrc,
  children,
}: {
  backdropUrl: string | null;
  colorSrc: string | null;
  children: ReactNode;
}) {
  const rgb = useDominantColor(colorSrc) ?? FALLBACK_RGB;

  return (
    <div className="relative isolate -mx-4 -mt-8 mb-8 overflow-hidden px-4 pt-8 sm:rounded-b-2xl">
      {backdropUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={backdropUrl}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-20 h-full w-full object-cover object-top opacity-50"
          loading="eager"
        />
      )}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 transition-[background] duration-700 ease-out"
        style={{
          background: `linear-gradient(to bottom, ${rgba(rgb, 0.85)} 0%, ${rgba(rgb, 0.45)} 40%, var(--color-surface) 100%)`,
        }}
      />
      {children}
    </div>
  );
}
