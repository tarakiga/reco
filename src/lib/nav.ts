// Fallback default used by site-config.ts when the config system has no published brand/nav (build-guide safe-default rule).
export const NAV_LINKS: { href: string; label: string }[] = [
  { href: "/", label: "Home" },
  { href: "/for-you", label: "For you" },
  { href: "/calendar", label: "Calendar" },
];
