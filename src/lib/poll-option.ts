/**
 * A poll option is either a whole title or one episode of it. Both are addressed
 * as "{titleId}:{season}:{episode}", where 0:0 means the whole title. That is the
 * same convention list_items and episode_watches already use, and it exists
 * because a uuid alone cannot say "season 1, episode 6".
 *
 * Keys are internal. They are built from database ids, never from user input, so
 * parseOptionKey guards against corrupt data rather than against an attacker.
 */
export interface OptionRef {
  titleId: string;
  season: number;
  episode: number;
}

export function optionKey(titleId: string, season = 0, episode = 0): string {
  return `${titleId}:${season}:${episode}`;
}

export function parseOptionKey(key: string): OptionRef | null {
  const parts = key.split(":");
  if (parts.length !== 3) return null;
  const [titleId, s, e] = parts;
  if (!titleId) return null;
  if (!/^\d+$/.test(s) || !/^\d+$/.test(e)) return null;
  return { titleId, season: Number(s), episode: Number(e) };
}

export function isEpisode(key: string): boolean {
  const ref = parseOptionKey(key);
  return ref !== null && ref.episode > 0;
}
