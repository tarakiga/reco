"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { meFetch } from "@/lib/me-client";
import { useToast } from "@/components/ui/Toast";

/** Turn this tag into a draft list (tag name = title, tagged titles = items) and
 *  open it in the list editor. */
export function TagToListButton({ slug }: { slug: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function convert() {
    setBusy(true);
    try {
      const { list } = await meFetch<{ list: { id: string } }>("/api/v1/me/lists/from-tag", {
        method: "POST",
        body: { slug },
      });
      toast({ title: "Saved as a draft list", variant: "success" });
      router.push(`/account/lists/${list.id}`);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Couldn't create the list", variant: "danger" });
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={convert}
      disabled={busy}
      className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm font-medium text-text transition-colors hover:bg-surface-overlay focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden="true">
        <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
      </svg>
      {busy ? "Saving…" : "Save as list"}
    </button>
  );
}
