"use client";
import { useEffect, useMemo, useRef, useState } from "react";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

interface YMD {
  y: number;
  m: number; // 0-11
  d: number;
}
function parse(s: string): YMD | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || "");
  return m ? { y: +m[1], m: +m[2] - 1, d: +m[3] } : null;
}
function shiftMonth(v: { y: number; m: number }, delta: number) {
  const total = v.y * 12 + v.m + delta;
  return { y: Math.floor(total / 12), m: ((total % 12) + 12) % 12 };
}
function triggerLabel(sel: YMD, time: string | null): string {
  const dt = new Date(sel.y, sel.m, sel.d);
  const base = dt.toLocaleDateString("en", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  if (!time) return base;
  const [h, mi] = time.split(":").map(Number);
  const t = new Date(sel.y, sel.m, sel.d, h || 0, mi || 0);
  return `${base}, ${t.toLocaleTimeString("en", { hour: "numeric", minute: "2-digit" })}`;
}

/**
 * A calendar-popover date picker. Replaces the native date input. `value` is
 * "YYYY-MM-DD" (or "YYYY-MM-DDTHH:mm" when `withTime`). `min`/`max` are inclusive
 * "YYYY-MM-DD" bounds. Styled with the app's tokens.
 */
export function DatePicker({
  value,
  onChange,
  min,
  max,
  withTime = false,
  placeholder = "Select a date",
  disabled,
  defaultOpen = false,
}: {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  withTime?: boolean;
  placeholder?: string;
  disabled?: boolean;
  defaultOpen?: boolean;
}) {
  const datePart = (value || "").slice(0, 10);
  const timePart = withTime ? (value || "").slice(11, 16) || "20:00" : "";
  const sel = parse(datePart);
  const today = ymd(new Date());

  const [open, setOpen] = useState(defaultOpen);
  const [view, setView] = useState(() => (sel ? { y: sel.y, m: sel.m } : parse(today)!));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const cells = useMemo(() => {
    const firstWeekday = new Date(view.y, view.m, 1).getDay();
    const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
    const out: (number | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) out.push(null);
    for (let d = 1; d <= daysInMonth; d++) out.push(d);
    return out;
  }, [view]);

  function emit(dStr: string, tStr: string) {
    onChange(withTime ? `${dStr}T${tStr}` : dStr);
  }
  function pickDay(dStr: string) {
    if (withTime) emit(dStr, timePart);
    else {
      emit(dStr, "");
      setOpen(false);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex h-9 w-full min-w-[12rem] items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 text-sm text-text transition-colors hover:bg-surface-overlay focus:outline-2 focus:outline-accent disabled:opacity-50"
      >
        <span className={sel ? "text-text" : "text-text-muted"}>
          {sel ? triggerLabel(sel, withTime ? timePart : null) : placeholder}
        </span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-4 shrink-0 text-text-muted" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      </button>

      {open && (
        <div role="dialog" className="absolute left-0 z-30 mt-1 w-72 rounded-lg border border-border bg-surface-raised p-3 shadow-overlay">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setView((v) => shiftMonth(v, -1))}
              aria-label="Previous month"
              className="inline-flex size-7 items-center justify-center rounded-md text-text-muted hover:bg-surface-overlay hover:text-text"
            >
              &#8249;
            </button>
            <span className="text-sm font-semibold text-text">
              {MONTHS[view.m]} {view.y}
            </span>
            <button
              type="button"
              onClick={() => setView((v) => shiftMonth(v, 1))}
              aria-label="Next month"
              className="inline-flex size-7 items-center justify-center rounded-md text-text-muted hover:bg-surface-overlay hover:text-text"
            >
              &#8250;
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-medium text-text-muted">
            {WEEKDAYS.map((w) => (
              <span key={w} className="py-1">{w}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((d, i) => {
              if (d === null) return <span key={i} />;
              const dStr = `${view.y}-${pad(view.m + 1)}-${pad(d)}`;
              const isDisabled = (max != null && dStr > max) || (min != null && dStr < min);
              const isSel = dStr === datePart;
              const isToday = dStr === today;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => pickDay(dStr)}
                  aria-pressed={isSel}
                  className={`inline-flex h-8 items-center justify-center rounded-md text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
                    isSel
                      ? "bg-accent font-semibold text-text"
                      : isToday
                        ? "border border-accent/50 text-text hover:bg-surface-overlay"
                        : "text-text hover:bg-surface-overlay"
                  }`}
                >
                  {d}
                </button>
              );
            })}
          </div>

          {withTime ? (
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
              <div className="flex items-center gap-1">
                <TimeSelect kind="hour" value={timePart} onChange={(t) => datePart && emit(datePart, t)} disabled={!datePart} />
                <span className="text-text-muted">:</span>
                <TimeSelect kind="minute" value={timePart} onChange={(t) => datePart && emit(datePart, t)} disabled={!datePart} />
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-text hover:bg-accent-hover"
              >
                Done
              </button>
            </div>
          ) : (
            <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  const ok = !(max != null && today > max) && !(min != null && today < min);
                  if (ok) pickDay(today);
                }}
                className="font-medium text-accent hover:underline"
              >
                Today
              </button>
              {value && (
                <button
                  type="button"
                  onClick={() => {
                    onChange("");
                    setOpen(false);
                  }}
                  className="text-text-muted hover:text-text"
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TimeSelect({
  kind,
  value,
  onChange,
  disabled,
}: {
  kind: "hour" | "minute";
  value: string;
  onChange: (time: string) => void;
  disabled?: boolean;
}) {
  const [h, mi] = (value || "20:00").split(":");
  const opts = kind === "hour" ? Array.from({ length: 24 }, (_, i) => i) : Array.from({ length: 12 }, (_, i) => i * 5);
  const current = kind === "hour" ? Number(h) : Number(mi);
  return (
    <select
      aria-label={kind}
      disabled={disabled}
      value={current}
      onChange={(e) => {
        const v = pad(Number(e.target.value));
        onChange(kind === "hour" ? `${v}:${mi}` : `${h}:${v}`);
      }}
      className="h-8 rounded-md border border-border bg-surface px-1.5 text-sm text-text [color-scheme:dark] disabled:opacity-50"
    >
      {opts.map((n) => (
        <option key={n} value={n}>{pad(n)}</option>
      ))}
    </select>
  );
}
