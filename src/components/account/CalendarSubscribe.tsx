"use client";
import { useState } from "react";
import { useToast } from "@/components/ui/Toast";

/**
 * Subscribe-to-calendar control. "Add to Google Calendar" deep-links Google's
 * add-by-URL flow; "Copy link" hands the feed URL to any calendar app (Apple,
 * Outlook). Google then polls the feed and fires the reminders — no server push.
 */
export function CalendarSubscribe({
  icsUrl,
  webcalUrl,
  googleUrl,
}: {
  icsUrl: string;
  webcalUrl: string;
  googleUrl: string;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(icsUrl);
      toast({ title: "Calendar link copied", variant: "success" });
    } catch {
      toast({ title: "Couldn't copy the link", variant: "danger" });
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm font-medium text-text transition-colors hover:bg-surface-overlay focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
        Add to calendar
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-20 mt-1 w-60 rounded-md border border-border bg-surface-raised p-1 shadow-overlay">
            <a
              href={googleUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="block rounded px-3 py-2 text-sm text-text transition-colors hover:bg-surface-overlay"
            >
              Add to Google Calendar
            </a>
            <a
              href={webcalUrl}
              onClick={() => setOpen(false)}
              className="block rounded px-3 py-2 text-sm text-text transition-colors hover:bg-surface-overlay"
            >
              Apple Calendar / Outlook
            </a>
            <button
              type="button"
              onClick={() => {
                copy();
                setOpen(false);
              }}
              className="block w-full rounded px-3 py-2 text-left text-sm text-text transition-colors hover:bg-surface-overlay"
            >
              Copy calendar link
            </button>
          </div>
        </>
      )}
    </div>
  );
}
