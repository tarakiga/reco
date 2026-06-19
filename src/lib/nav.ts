// Fallback default used by site-config.ts when the config system has no published brand/nav (build-guide safe-default rule).
export const NAV_LINKS: { href: string; label: string }[] = [
  { href: "/", label: "Home" },
  { href: "/for-you", label: "For you" },
  { href: "/calendar", label: "Calendar" },
  { href: "/guide", label: "TV guide" },
  { href: "/moods", label: "Moods" },
  { href: "/what-can-i-do", label: "What can I do?" },
];
