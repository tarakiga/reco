"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "haystackk-analytics-consent";
type Choice = "granted" | "denied";

/** Tell GA Consent Mode the visitor's choice (no-op until gtag has loaded). */
function applyConsent(choice: Choice) {
  const w = window as unknown as { gtag?: (...args: unknown[]) => void };
  w.gtag?.("consent", "update", { analytics_storage: choice === "granted" ? "granted" : "denied" });
}

/**
 * A small, non-blocking consent banner for analytics cookies. Sits in the
 * bottom corner rather than over the page. GA already defaults to consent
 * "denied" (cookieless), so this only ever upgrades to "granted" on accept and
 * remembers the choice so it isn't asked again.
 */
export function ConsentBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      /* storage blocked, just show the banner */
    }
    if (stored === "granted") {
      applyConsent("granted"); // re-affirm on each visit
      return;
    }
    if (stored === "denied") return; // respect the prior decline
    setShow(true);
  }, []);

  function choose(choice: Choice) {
    try {
      localStorage.setItem(STORAGE_KEY, choice);
    } catch {
      /* ignore */
    }
    applyConsent(choice);
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-3 pb-3 sm:inset-x-auto sm:right-4 sm:max-w-md">
      <div
        role="dialog"
        aria-label="Analytics consent"
        className="rounded-xl border border-border bg-surface-raised p-4 shadow-overlay"
      >
        <p className="text-sm font-semibold text-text">Help us improve Haystackk</p>
        <p className="mt-1.5 text-xs leading-relaxed text-text-muted">
          We&apos;d like to use Google Analytics to understand how Haystackk is used: which pages and
          features people reach for, what&apos;s slow, and what to build next, so we can keep making it
          better. It sets analytics cookies and collects anonymous usage data such as the pages you
          visit, your approximate region, and your device type. We never sell your data or use it to
          identify you, and until you choose, analytics runs in a cookieless mode that stores nothing on
          your device. You can change your mind anytime. See our{" "}
          <Link href="/privacy" className="underline hover:text-text">
            Privacy policy
          </Link>{" "}
          for the full detail.
        </p>
        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => choose("denied")}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text hover:bg-surface-overlay"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={() => choose("granted")}
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-hover"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
