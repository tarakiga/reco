// Timezone helpers for aligning EPG fetch windows to a region's local calendar
// day. Without this, a UTC-day window misses the currently-airing programme near
// the day boundary (overnight for zones ahead of UTC, evening for zones behind),
// so nothing shows as "on now".

/** YYYY-MM-DD calendar date of an instant in a timezone. */
export function zonedDate(iso: string | number | Date, tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

/** UTC [start, end) bounds of a local calendar day (YYYY-MM-DD) in a timezone. */
export function zonedDayBounds(ymd: string, tz: string): { start: Date; end: Date } {
  const offsetMs = (d: Date) => {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        hour12: false,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
        .formatToParts(d)
        .map((x) => [x.type, x.value]),
    );
    const hour = p.hour === "24" ? 0 : Number(p.hour);
    const asUTC = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), hour, Number(p.minute), Number(p.second));
    return asUTC - d.getTime();
  };
  const guess = new Date(`${ymd}T00:00:00Z`);
  const startMs = guess.getTime() - offsetMs(guess);
  return { start: new Date(startMs), end: new Date(startMs + 24 * 60 * 60 * 1000) };
}
