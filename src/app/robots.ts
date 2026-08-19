import type { MetadataRoute } from "next";

// A crawler walking /title/[id] and /person/[id] by sequential TMDB id was
// inflating the catalog + Voyage spend. Block the known AI/scraper bots that do
// systematic id-walks, throttle everyone else, and keep private/API paths out.
const AI_SCRAPERS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "CCBot",
  "ClaudeBot",
  "anthropic-ai",
  "Claude-Web",
  "Bytespider",
  "Amazonbot",
  "PerplexityBot",
  "Google-Extended",
  "Applebot-Extended",
  "cohere-ai",
  "Diffbot",
  "ImagesiftBot",
  "Omgilibot",
  "meta-externalagent",
  "FacebookBot",
  "DataForSeoBot",
  "SemrushBot",
  "AhrefsBot",
  "MJ12bot",
  "DotBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Disallow the scraper bots entirely.
      { userAgent: AI_SCRAPERS, disallow: "/" },
      // Everyone else: allowed, but throttled, and kept off private/API paths.
      // /find and /rank are excluded because they are result pages, not content:
      // every distinct query is a new URL, so crawling them generates unbounded
      // paths (12k distinct in six hours at last measure) and each one runs a
      // vector search. Search results are conventionally kept out of the index.
      // Episode pages are excluded for the same reason of volume: one page per
      // episode is a very large surface, and they exist to be shared, not found.
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/account", "/admin", "/api", "/find", "/rank", "/title/*/*/s*e*"],
        crawlDelay: 10,
      },
    ],
  };
}
