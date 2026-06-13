import type { ReactNode } from "react";

/**
 * Hero wrapper: optional backdrop image with a neutral scrim for title
 * legibility, fading into the page. The page's dynamic color now comes from
 * AmbientBackground (the page background), not from this image — so the image
 * stays true to itself and the color reads as the page wash behind everything.
 *
 * `children` (poster + title block) render above the backdrop.
 */
export function HeroBackdrop({
  backdropUrl,
  children,
}: {
  backdropUrl: string | null;
  children: ReactNode;
}) {
  return (
    <div className="relative isolate -mx-4 -mt-8 mb-8 overflow-hidden px-4 pt-8 sm:rounded-b-2xl">
      {backdropUrl && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={backdropUrl}
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover object-top opacity-45"
            loading="eager"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              background:
                "linear-gradient(to bottom, rgb(11 13 18 / 0.1) 0%, rgb(11 13 18 / 0.55) 65%, var(--color-surface) 100%)",
            }}
          />
        </>
      )}
      {children}
    </div>
  );
}
