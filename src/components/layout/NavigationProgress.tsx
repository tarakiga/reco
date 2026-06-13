"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Global top progress bar that gives immediate "something is happening" feedback
 * on every in-app navigation. App Router has no router-events API, so we detect
 * navigation *starts* from internal link clicks / GET form submits, trickle the
 * bar toward 90%, then complete it when the pathname or query actually settles.
 *
 * Dependency-free. Lives once in the root layout (under a Suspense boundary
 * because it reads useSearchParams).
 */
const TRICKLE_MS = 200;
const FADE_MS = 250;
const SAFETY_MS = 10_000;

export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  const active = useRef(false);
  const trickle = useRef<ReturnType<typeof setInterval> | null>(null);
  const fade = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safety = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstSettle = useRef(true);

  function clearTimers() {
    if (trickle.current) clearInterval(trickle.current);
    if (fade.current) clearTimeout(fade.current);
    if (safety.current) clearTimeout(safety.current);
    trickle.current = fade.current = safety.current = null;
  }

  function start() {
    if (active.current) return;
    active.current = true;
    clearTimers();
    setVisible(true);
    setProgress(8);
    // Ease toward 90% and wait there until the route resolves.
    trickle.current = setInterval(() => {
      setProgress((p) => (p < 90 ? p + Math.max(0.4, (90 - p) * 0.08) : p));
    }, TRICKLE_MS);
    // Failsafe: if a click never produces a navigation, don't leave the bar stuck.
    safety.current = setTimeout(complete, SAFETY_MS);
  }

  function complete() {
    if (!active.current) return;
    active.current = false;
    clearTimers();
    setProgress(100);
    fade.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, FADE_MS);
  }

  // Detect navigation starts.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      const target = anchor.getAttribute("target");
      if (!href || (target && target !== "_self")) return;
      if (anchor.hasAttribute("download")) return;
      if (href.startsWith("#")) return;
      // External / non-navigational schemes (http:, mailto:, tel:, …).
      if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return;
      // Skip clicks that resolve to the current URL (no navigation will occur).
      const query = searchParams.toString();
      const current = query ? `${pathname}?${query}` : pathname;
      if (href === current || href === pathname) return;
      start();
    }
    function onSubmit(e: SubmitEvent) {
      const form = e.target as HTMLFormElement | null;
      if (!form || e.defaultPrevented) return;
      if ((form.getAttribute("method") || "get").toLowerCase() === "get") start();
    }
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  // Route settled → finish the bar (skip the initial mount).
  useEffect(() => {
    if (firstSettle.current) {
      firstSettle.current = false;
      return;
    }
    complete();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  // Clean up on unmount.
  useEffect(() => clearTimers, []);

  if (!visible) return null;
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5"
      role="progressbar"
      aria-label="Page loading"
      aria-busy="true"
    >
      <div
        className="h-full bg-accent transition-[width,opacity] duration-200 ease-out"
        style={{
          width: `${progress}%`,
          opacity: progress >= 100 ? 0 : 1,
          boxShadow: "0 0 8px var(--color-accent), 0 0 2px var(--color-accent)",
        }}
      />
    </div>
  );
}
