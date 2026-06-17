// Catalog powering the "What can I do?" discovery page. Keep this in sync as
// features ship. `where` is a short human location; `href` links to the closest
// place to use it. (House style: no em dashes anywhere.)

export interface FeatureCategory {
  id: string;
  label: string;
  emoji: string;
}

export interface Feature {
  name: string;
  blurb: string;
  where: string;
  href: string;
  category: string;
  emoji: string;
  isNew?: boolean;
}

export const FEATURE_CATEGORIES: FeatureCategory[] = [
  { id: "discover", label: "Discover", emoji: "🔍" },
  { id: "track", label: "Track & organise", emoji: "📌" },
  { id: "stats", label: "Your stats", emoji: "🏆" },
  { id: "together", label: "Watch together", emoji: "👥" },
  { id: "title", label: "On every title", emoji: "🎬" },
];

export const FEATURES: Feature[] = [
  // Discover
  { category: "discover", emoji: "🔎", name: "Smart search", blurb: "Find any movie or show. Typos are forgiven, so “emerdale” still finds Emmerdale.", where: "Search bar, top of every page", href: "/search" },
  { category: "discover", emoji: "🧩", name: "Describe a scene", blurb: "Forgot the title? Describe a scene you remember and we find the closest matches.", where: "The Find page", href: "/find" },
  { category: "discover", emoji: "🎲", name: "Shuffle", blurb: "Can't decide? Pick your streaming services and we deal a few great picks to watch right now.", where: "Shuffle", href: "/shuffle" },
  { category: "discover", emoji: "🎭", name: "Mood & occasion rails", blurb: "Pick a vibe or an occasion and we line up the watches. Spooky season, date night, mind-benders and more.", where: "Browse by mood", href: "/moods", isNew: true },
  { category: "discover", emoji: "📅", name: "Release calendar", blurb: "What's coming to cinemas and streaming over the next two months, with a theatres or streaming filter.", where: "Calendar", href: "/calendar", isNew: true },
  { category: "discover", emoji: "🆕", name: "New to streaming", blurb: "Films that just landed on subscription streaming in your region.", where: "Top of the Calendar page", href: "/calendar", isNew: true },
  { category: "discover", emoji: "✨", name: "For you", blurb: "Personalised picks that learn from what you rate and watch.", where: "For you", href: "/for-you" },
  { category: "discover", emoji: "🍿", name: "Browse movies", blurb: "Browse and filter the movie catalogue by genre and year.", where: "Movies", href: "/movies" },
  { category: "discover", emoji: "📺", name: "Browse TV", blurb: "Browse and filter TV shows, with status badges for what's returning or ended.", where: "TV Shows", href: "/tv" },

  // Track & organise
  { category: "track", emoji: "🔖", name: "Watchlist", blurb: "Track what you want to watch, are watching, or have finished.", where: "Any title page, or your Watchlist", href: "/watchlist" },
  { category: "track", emoji: "⭐", name: "Rate & share a poster", blurb: "Rate a title, then download its poster stamped with your score to share.", where: "Any movie or show page", href: "/movies" },
  { category: "track", emoji: "❤️", name: "Favourites", blurb: "Heart titles straight from the grid, no need to open them first.", where: "Any card, or your Favourites", href: "/account?tab=favourites" },
  { category: "track", emoji: "📔", name: "Watch diary", blurb: "Log what you watched and when, like a film diary. Rewatches welcome.", where: "Title pages and your Diary", href: "/account?tab=diary" },
  { category: "track", emoji: "🏷️", name: "Tags & collections", blurb: "Label titles with your own private tags, then turn any tag into a list.", where: "Title pages and your Tags", href: "/account?tab=tags" },
  { category: "track", emoji: "📝", name: "Shareable lists", blurb: "Build ranked lists with notes and share them with a rich preview card.", where: "Your Lists", href: "/account?tab=lists" },

  // Your stats
  { category: "stats", emoji: "🏆", name: "Completion tracking", blurb: "See how much of a franchise, or a director's and writer's work, you've watched.", where: "Movie and person pages, and your Completion tab", href: "/account?tab=completion", isNew: true },
  { category: "stats", emoji: "🗓️", name: "Coming up + calendar sync", blurb: "A personal TV schedule built from your watchlist, subscribable to Google Calendar.", where: "Your Coming up tab", href: "/account?tab=coming-up" },
  { category: "stats", emoji: "🎚️", name: "Taste profile", blurb: "Set your region and favourite genres to sharpen every recommendation.", where: "Account settings", href: "/account?tab=settings" },

  // Watch together
  { category: "together", emoji: "🗳️", name: "Vote to Watch", blurb: "Create a group poll, friends vote with no signup, and a two-round runoff settles what you all watch.", where: "Your Vote tab", href: "/account?tab=vote", isNew: true },
  { category: "together", emoji: "🔗", name: "Share anything", blurb: "Share any title, person, or list with a rich preview card straight to your apps.", where: "Share button on title, person and list pages", href: "/movies" },

  // On every title
  { category: "title", emoji: "📡", name: "Where to watch", blurb: "See the streaming services a title is on in your region.", where: "Any title page (example: The Dark Knight)", href: "/title/movie/155-the-dark-knight" },
  { category: "title", emoji: "▶️", name: "Trailers", blurb: "Watch the trailer right on the page.", where: "Any title page (example: The Dark Knight)", href: "/title/movie/155-the-dark-knight" },
  { category: "title", emoji: "🎬", name: "Cast & crew", blurb: "Clickable cast and crew, with full-series cast for TV shows.", where: "Any title page (example: The Dark Knight)", href: "/title/movie/155-the-dark-knight" },
  { category: "title", emoji: "🔭", name: "Episode finder", blurb: "Find any episode and read synopses season by season.", where: "Any TV show page (example: Breaking Bad)", href: "/title/tv/1396-breaking-bad" },
  { category: "title", emoji: "🧬", name: "Collections & related", blurb: "Jump to sequels, spinoffs, remakes and similar titles.", where: "Any title page (example: The Dark Knight)", href: "/title/movie/155-the-dark-knight" },
  { category: "title", emoji: "🥇", name: "Awards", blurb: "Oscars and Emmys on the people behind your favourites.", where: "Any person page (example: Meryl Streep)", href: "/person/5064-meryl-streep" },
];
