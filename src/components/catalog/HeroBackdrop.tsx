import type { ReactNode } from "react";

/**
 * Full-bleed hero: spans the full viewport width and sits flush against the top
 * of the content area (the `-mt-16` cancels the page + main top padding). An
 * optional backdrop image gets a neutral legibility scrim; the page's dynamic
 * color comes from AmbientBackground behind everything.
 *
 * `children` (poster + title block) are re-constrained to the page's max width
 * so they line up with the body content below.
 */
export function HeroBackdrop({
  backdropUrl,
  children,
}: {
  backdropUrl: string | null;
  children: ReactNode;
}) {
  return (
    <div className="relative left-1/2 isolate -mt-16 mb-8 w-screen -translate-x-1/2 overflow-hidden">
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
      <div className="mx-auto max-w-5xl px-4">{children}</div>
    </div>
  );
}
