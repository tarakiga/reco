"use client";
import { useMemo } from "react";

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function level(n: number): string {
  if (n <= 0) return "bg-surface-overlay";
  if (n === 1) return "bg-accent/30";
  if (n === 2) return "bg-accent/55";
  if (n === 3) return "bg-accent/75";
  return "bg-accent";
}

/** A GitHub-style contribution heatmap of the last year of diary entries. */
export function ViewingHeatmap({ entries }: { entries: { watchedOn: string }[] }) {
  const { weeks, monthCols, total } = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of entries) counts.set(e.watchedOn, (counts.get(e.watchedOn) ?? 0) + 1);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(start.getDate() - 7 * 52);
    start.setDate(start.getDate() - start.getDay()); // back to the week's Sunday

    const weeks: { key: string; count: number; future: boolean; label: string }[][] = [];
    const monthCols: { col: number; label: string }[] = [];
    const cur = new Date(start);
    let lastMonth = -1;
    let col = 0;
    let total = 0;
    while (cur <= today) {
      const week: { key: string; count: number; future: boolean; label: string }[] = [];
      for (let d = 0; d < 7; d++) {
        const key = ymd(cur);
        const future = cur > today;
        const count = future ? 0 : counts.get(key) ?? 0;
        if (!future) total += count;
        const label = `${count} watched on ${cur.toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" })}`;
        if (d === 0 && cur.getMonth() !== lastMonth) {
          lastMonth = cur.getMonth();
          monthCols.push({ col, label: MONTHS[cur.getMonth()] });
        }
        week.push({ key, count, future, label });
        cur.setDate(cur.getDate() + 1);
      }
      weeks.push(week);
      col++;
    }
    return { weeks, monthCols, total };
  }, [entries]);

  return (
    <div className="rounded-lg border border-border bg-surface-raised p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-text">Your viewing year</h3>
        <span className="text-xs text-text-muted">{total} logged in the last 12 months</span>
      </div>
      <div className="overflow-x-auto">
        <div className="inline-flex flex-col gap-1">
          <div className="relative h-3" style={{ width: weeks.length * 16 }}>
            {monthCols.map((m) => (
              <span key={`${m.col}-${m.label}`} className="absolute text-[10px] text-text-muted" style={{ left: m.col * 16 }}>
                {m.label}
              </span>
            ))}
          </div>
          <div className="flex gap-1">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-1">
                {week.map((cell) => (
                  <span
                    key={cell.key}
                    title={cell.future ? undefined : cell.label}
                    className={`size-3 rounded-[3px] ${cell.future ? "bg-transparent" : level(cell.count)}`}
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="mt-1 flex items-center gap-1 text-[10px] text-text-muted">
            Less
            <span className="size-3 rounded-[3px] bg-surface-overlay" />
            <span className="size-3 rounded-[3px] bg-accent/30" />
            <span className="size-3 rounded-[3px] bg-accent/55" />
            <span className="size-3 rounded-[3px] bg-accent/75" />
            <span className="size-3 rounded-[3px] bg-accent" />
            More
          </div>
        </div>
      </div>
    </div>
  );
}
