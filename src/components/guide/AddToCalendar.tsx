"use client";
import { useEffect, useRef, useState } from "react";
import { calEvent, googleCalendarUrl, icsForEvent } from "@/lib/guide/calendar";
import type { GuideEntry } from "@/services/guide";

/** Calendar icon that offers a Google Calendar link + .ics download for a
 *  programme. Renders nothing for past airings (a reminder for them is useless). */
export function AddToCalendar({
  entry,
  channel,
  service,
  className,
}: {
  entry: GuideEntry;
  channel: string;
  service?: string | null;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const ev = calEvent(entry, channel, service);
  if (!ev || ev.startMs <= Date.now()) return null;

  function downloadIcs() {
    if (!ev) return;
    const blob = new Blob([icsForEvent(ev, Date.now())], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${entry.showName.replace(/[^\w]+/g, "-").slice(0, 40) || "reminder"}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setOpen(false);
  }

  return (
    <div ref={ref} className={`relative ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Set a reminder"
        title="Add a reminder to your calendar"
        className="flex size-6 items-center justify-center rounded text-text-muted transition-colors hover:bg-surface-overlay hover:text-accent-text"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden>
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 z-30 mt-1 w-44 overflow-hidden rounded-md border border-border bg-surface-raised py-1 shadow-overlay">
          <a
            href={googleCalendarUrl(ev)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="block px-3 py-1.5 text-sm text-text hover:bg-surface-overlay"
          >
            Google Calendar
          </a>
          <button
            type="button"
            onClick={downloadIcs}
            className="block w-full px-3 py-1.5 text-left text-sm text-text hover:bg-surface-overlay"
          >
            Apple / Outlook (.ics)
          </button>
        </div>
      )}
    </div>
  );
}
