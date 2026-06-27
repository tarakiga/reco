"use client";
import { useState } from "react";

/**
 * Downloads the tier-list PNG, showing a spinner while the image renders and
 * transfers (it fetches the blob rather than navigating, so we can reflect
 * activity and name the file). `format="banner"` requests the 1920×384 variant.
 */
export function DownloadTierImage({
  idSlug,
  slug,
  format,
  label,
}: {
  idSlug: string;
  slug: string;
  format?: "banner";
  label: string;
}) {
  const [loading, setLoading] = useState(false);

  async function onClick() {
    if (loading) return;
    setLoading(true);
    try {
      const url = `/api/share/list/${idSlug}${format ? `?format=${format}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = `${slug || "tier-list"}${format === "banner" ? "-banner" : ""}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
    } catch {
      /* swallow — the button re-enables so the user can retry */
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      aria-busy={loading}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-text transition-colors hover:border-accent hover:text-accent disabled:opacity-60"
    >
      {loading ? (
        <svg viewBox="0 0 24 24" fill="none" className="size-4 animate-spin" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.25" />
          <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden="true">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
        </svg>
      )}
      {loading ? "Preparing…" : label}
    </button>
  );
}
