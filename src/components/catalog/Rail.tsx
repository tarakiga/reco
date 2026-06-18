"use client";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Horizontal card carousel. Hides the scrollbar and instead signals that there
 * is more to scroll with edge fade-outs and hover arrows (desktop), so cards
 * never just hard-cut at the sides.
 */
export function Rail({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdges({
      left: el.scrollLeft > 8,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 8,
    });
  }, []);

  useEffect(() => {
    update();
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [update]);

  function nudge(dir: -1 | 1) {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  }

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 className="text-lg font-semibold text-text">{title}</h2>
        {action}
      </div>

      <div className="group relative">
        <div
          ref={ref}
          onScroll={update}
          className="flex gap-4 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {children}
        </div>

        {/* Edge fades — cards dissolve into the page instead of hard-cutting. */}
        <div
          className={`pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-surface to-transparent transition-opacity duration-200 ${edges.left ? "opacity-100" : "opacity-0"}`}
        />
        <div
          className={`pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-surface to-transparent transition-opacity duration-200 ${edges.right ? "opacity-100" : "opacity-0"}`}
        />

        {/* Hover arrows (desktop). */}
        {edges.left && (
          <button
            type="button"
            onClick={() => nudge(-1)}
            aria-label="Scroll left"
            className="absolute left-1 top-[40%] z-20 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface-raised/90 text-lg text-text shadow-overlay backdrop-blur transition hover:bg-surface-overlay group-hover:flex"
          >
            &#8249;
          </button>
        )}
        {edges.right && (
          <button
            type="button"
            onClick={() => nudge(1)}
            aria-label="Scroll right"
            className="absolute right-1 top-[40%] z-20 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface-raised/90 text-lg text-text shadow-overlay backdrop-blur transition hover:bg-surface-overlay group-hover:flex"
          >
            &#8250;
          </button>
        )}
      </div>
    </section>
  );
}
