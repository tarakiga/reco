"use client";
import { useState } from "react";
import { useToast } from "@/components/ui/Toast";

/**
 * Share the current page. Uses the native Web Share sheet where available
 * (mobile + some desktop browsers), otherwise copies the link to the clipboard.
 */
export function ShareButton({ title, label = "Share" }: { title: string; label?: string }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function handleShare() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const data: ShareData = { title, text: title, url };

    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share(data);
      } catch {
        // User dismissed the share sheet — not an error.
      }
      return;
    }

    setBusy(true);
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied to clipboard", variant: "success" });
    } catch {
      toast({ title: "Couldn't copy the link", variant: "danger" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      disabled={busy}
      aria-label="Share"
      className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-medium text-text transition-colors hover:bg-surface-overlay focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-4"
        aria-hidden="true"
      >
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98" />
      </svg>
      {label}
    </button>
  );
}
