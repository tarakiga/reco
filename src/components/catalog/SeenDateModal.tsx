"use client";
import { useEffect } from "react";
import { DatePicker } from "@/components/ui/DatePicker";

const today = () => new Date().toISOString().slice(0, 10);

/**
 * "When did you see this?" — the gate before rating. The calendar opens on the
 * title's release date (a sensible default; earlier is still allowed for
 * festival/preview screenings) and caps at today. Picking a date logs it to the
 * diary, which unlocks the rating.
 */
export function SeenDateModal({
  releaseDate,
  onPick,
  onClose,
}: {
  releaseDate: string | null;
  onPick: (date: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" className="absolute inset-0 cursor-default bg-black/70" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm rounded-lg border border-border bg-surface-raised p-5 shadow-overlay">
        <div className="mb-1 flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold text-text">When did you see this?</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded px-2 py-0.5 text-text-muted hover:text-text">
            ✕
          </button>
        </div>
        <p className="mb-3 text-xs text-text-muted">Tap a date to log it, then you can leave your rating.</p>
        <DatePicker
          value={releaseDate ?? ""}
          onChange={(d) => d && onPick(d)}
          max={today()}
          defaultOpen
          placeholder="Pick a date watched"
        />
      </div>
    </div>
  );
}
