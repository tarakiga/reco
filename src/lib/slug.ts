export function slugify(input: string): string {
  const s = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s.length > 0 ? s : "untitled";
}

/** Year from an ISO-ish date ("1999-03-31") or a bare year ("1999"). Null when
 *  the date is missing or does not start with four digits, so a malformed value
 *  cannot reach a card's year or a URL. */
export function yearFromDate(date: string | null | undefined): number | null {
  return date && /^\d{4}/.test(date) ? Number(date.slice(0, 4)) : null;
}

export function titleSlug(title: string, date: string | null | undefined): string {
  const year = yearFromDate(date);
  const base = slugify(title);
  return year ? `${base}-${year}` : base;
}
