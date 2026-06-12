export function usernameBase(input: string): string {
  const base = input
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 20);
  return base.length >= 3 ? base : `user${base}`;
}
