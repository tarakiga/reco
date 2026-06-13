export function slugify(input: string): string {
  const s = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s.length > 0 ? s : "untitled";
}

export function titleSlug(title: string, date: string | null | undefined): string {
  const year = date && date.length >= 4 ? date.slice(0, 4) : "";
  const base = slugify(title);
  return year ? `${base}-${year}` : base;
}
