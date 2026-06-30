"use client";
import { useEffect, useMemo, useRef, useState } from "react";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
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

type Mode = "days" | "months" | "years";

/**
 * A calendar-popover date picker. Replaces the native date input. `value` is
 * "YYYY-MM-DD" (or "YYYY-MM-DDTHH:mm" when `withTime`). `min`/`max` are inclusive
 * "YYYY-MM-DD" bounds, enforced across day/month/year views. Click the header to
 * jump by year, so back-dating decades is a couple of clicks.
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
  const [mode, setMode] = useState<Mode>("days");
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

  // ---- bounds helpers (inclusive) ----
  const dayDisabled = (s: string) => (max != null && s > max) || (min != null && s < min);
  const monthDisabled = (y: number, m: number) => {
    const last = new Date(y, m + 1, 0).getDate();
    return (max != null && `${y}-${pad(m + 1)}-01` > max) || (min != null && `${y}-${pad(m + 1)}-${pad(last)}` < min);
  };
  const yearDisabled = (y: number) => (max != null && `${y}-01-01` > max) || (min != null && `${y}-12-31` < min);

  const cells = useMemo(() => {
    const firstWeekday = new Date(view.y, view.m, 1).getDay();
    const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
    const out: (number | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) out.push(null);
    for (let d = 1; d <= daysInMonth; d++) out.push(d);
    return out;
  }, [view]);

  const yearsStart = view.y - 5; // 12-year window anchored on the focused year

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
  function openTo() {
    setMode("days");
    setOpen(true);
  }

  // ---- header (prev / center / next) per mode ----
  const header = {
    days: {
      label: `${MONTHS[view.m]} ${view.y}`,
      onCenter: () => setMode("years"),
      prev: () => setView((v) => shiftMonth(v, -1)),
      next: () => setView((v) => shiftMonth(v, 1)),
    },
    months: {
      label: `${view.y}`,
      onCenter: () => setMode("years"),
      prev: () => setView((v) => ({ ...v, y: v.y - 1 })),
      next: () => setView((v) => ({ ...v, y: v.y + 1 })),
    },
    years: {
      label: `${yearsStart} – ${yearsStart + 11}`,
      onCenter: () => setMode("days"),
      prev: () => setView((v) => ({ ...v, y: v.y - 12 })),
      next: () => setView((v) => ({ ...v, y: v.y + 12 })),
    },
  }[mode];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openTo())}
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
            <button type="button" onClick={header.prev} aria-label="Previous" className="inline-flex size-7 items-center justify-center rounded-md text-text-muted hover:bg-surface-overlay hover:text-text">&#8249;</button>
            <button type="button" onClick={header.onCenter} className="rounded-md px-2 py-1 text-sm font-semibold text-text hover:bg-surface-overlay">
              {header.label}
            </button>
            <button type="button" onClick={header.next} aria-label="Next" className="inline-flex size-7 items-center justify-center rounded-md text-text-muted hover:bg-surface-overlay hover:text-text">&#8250;</button>
          </div>

          {mode === "days" && (
            <>
              <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-medium text-text-muted">
                {WEEKDAYS.map((w) => (
                  <span key={w} className="py-1">{w}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {cells.map((d, i) => {
                  if (d === null) return <span key={i} />;
                  const dStr = `${view.y}-${pad(view.m + 1)}-${pad(d)}`;
                  const isSel = dStr === datePart;
                  const isToday = dStr === today;
                  return (
                    <button
                      key={i}
                      type="button"
                      disabled={dayDisabled(dStr)}
                      onClick={() => pickDay(dStr)}
                      aria-pressed={isSel}
                      className={`inline-flex h-8 items-center justify-center rounded-md text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
                        isSel ? "bg-accent font-semibold text-text" : isToday ? "border border-accent/50 text-text hover:bg-surface-overlay" : "text-text hover:bg-surface-overlay"
                      }`}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {mode === "months" && (
            <div className="grid grid-cols-3 gap-1">
              {MONTHS_SHORT.map((mn, m) => {
                const isSel = sel?.y === view.y && sel?.m === m;
                return (
                  <button
                    key={mn}
                    type="button"
                    disabled={monthDisabled(view.y, m)}
                    onClick={() => {
                      setView((v) => ({ ...v, m }));
                      setMode("days");
                    }}
                    className={`inline-flex h-10 items-center justify-center rounded-md text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
                      isSel ? "bg-accent font-semibold text-text" : "text-text hover:bg-surface-overlay"
                    }`}
                  >
                    {mn}
                  </button>
                );
              })}
            </div>
          )}

          {mode === "years" && (
            <div className="grid grid-cols-4 gap-1">
              {Array.from({ length: 12 }, (_, i) => yearsStart + i).map((y) => {
                const isSel = sel?.y === y;
                return (
                  <button
                    key={y}
                    type="button"
                    disabled={yearDisabled(y)}
                    onClick={() => {
                      setView((v) => ({ ...v, y }));
                      setMode("months");
                    }}
                    className={`inline-flex h-10 items-center justify-center rounded-md text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
                      isSel ? "bg-accent font-semibold text-text" : "text-text hover:bg-surface-overlay"
                    }`}
                  >
                    {y}
                  </button>
                );
              })}
            </div>
          )}

          {mode === "days" &&
            (withTime ? (
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
                <div className="flex items-center gap-1">
                  <TimeSelect kind="hour" value={timePart} onChange={(t) => datePart && emit(datePart, t)} disabled={!datePart} />
                  <span className="text-text-muted">:</span>
                  <TimeSelect kind="minute" value={timePart} onChange={(t) => datePart && emit(datePart, t)} disabled={!datePart} />
                </div>
                <button type="button" onClick={() => setOpen(false)} className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-text hover:bg-accent-hover">
                  Done
                </button>
              </div>
            ) : (
              <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    if (!dayDisabled(today)) {
                      const t = parse(today)!;
                      setView({ y: t.y, m: t.m });
                      pickDay(today);
                    }
                  }}
                  className="font-medium text-accent-text hover:underline"
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
            ))}
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
