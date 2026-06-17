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
      { userAgent: "*", allow: "/", disallow: ["/account", "/admin", "/api"], crawlDelay: 10 },
    ],
  };
}
