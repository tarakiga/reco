// Achievement badges, computed purely from counts the account page already
// loads — no new tables. Earned when the matching stat clears the threshold.

export interface BadgeStats {
  diary: number;
  favourites: number;
  lists: number;
  tags: number;
  franchisesCompleted: number;
}

export interface BadgeDef {
  id: string;
  emoji: string;
  name: string;
  desc: string;
  stat: keyof BadgeStats;
  threshold: number;
}

export interface Badge extends BadgeDef {
  value: number;
  earned: boolean;
}

export const BADGES: BadgeDef[] = [
  { id: "first-log", emoji: "🎬", name: "First log", desc: "Logged your first watch", stat: "diary", threshold: 1 },
  { id: "diarist", emoji: "📔", name: "Diarist", desc: "Logged 25 watches", stat: "diary", threshold: 25 },
  { id: "cinephile", emoji: "🍿", name: "Cinephile", desc: "Logged 100 watches", stat: "diary", threshold: 100 },
  { id: "collector", emoji: "❤️", name: "Collector", desc: "25 favourites", stat: "favourites", threshold: 25 },
  { id: "curator", emoji: "📝", name: "Curator", desc: "Made 3 lists", stat: "lists", threshold: 3 },
  { id: "tagger", emoji: "🏷️", name: "Tagger", desc: "10 tags", stat: "tags", threshold: 10 },
  { id: "completionist", emoji: "🏆", name: "Completionist", desc: "Finished a franchise", stat: "franchisesCompleted", threshold: 1 },
  { id: "franchise-master", emoji: "👑", name: "Franchise master", desc: "Finished 5 franchises", stat: "franchisesCompleted", threshold: 5 },
];

export function computeBadges(stats: BadgeStats): Badge[] {
  return BADGES.map((b) => {
    const value = stats[b.stat];
    return { ...b, value, earned: value >= b.threshold };
  });
}
