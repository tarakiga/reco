import { cn } from "@/lib/cn";
import type { Fact } from "@/lib/tmdb/detail";

type IconName =
  | "status"
  | "language"
  | "seasons"
  | "episodes"
  | "binge"
  | "network"
  | "money"
  | "cinema"
  | "vod"
  | "default";

const ICON_FOR_LABEL: Record<string, IconName> = {
  Status: "status",
  "Original language": "language",
  Season: "seasons",
  Seasons: "seasons",
  Episodes: "episodes",
  "Binge watch": "binge",
  Network: "network",
  Budget: "money",
  Revenue: "money",
  "In cinemas": "cinema",
  VOD: "vod",
};

function Icon({ name }: { name: IconName }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "h-4 w-4",
    "aria-hidden": true,
  };
  switch (name) {
    case "binge": // clock
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v4l3 2" />
        </svg>
      );
    case "language": // globe
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18" />
          <ellipse cx="12" cy="12" rx="4" ry="9" />
        </svg>
      );
    case "seasons": // layers
      return (
        <svg {...common}>
          <path d="m12 3 9 5-9 5-9-5 9-5Z" />
          <path d="m3 13 9 5 9-5" />
        </svg>
      );
    case "episodes": // stacked frames
      return (
        <svg {...common}>
          <rect x="3" y="3" width="13" height="13" rx="2" />
          <path d="M21 8v11a2 2 0 0 1-2 2H8" />
        </svg>
      );
    case "network": // tv
      return (
        <svg {...common}>
          <rect x="2" y="7" width="20" height="13" rx="2" />
          <path d="m7 7 5-4 5 4" />
        </svg>
      );
    case "money": // banknote
      return (
        <svg {...common}>
          <rect x="2" y="6" width="20" height="12" rx="2" />
          <circle cx="12" cy="12" r="2.5" />
          <path d="M6 12h.01M18 12h.01" />
        </svg>
      );
    case "cinema": // film / ticket
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M3 9h18M8 4v5M16 4v5M8 20v-5M16 20v-5" />
        </svg>
      );
    case "vod": // play in a frame
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m10 9 5 3-5 3V9Z" />
        </svg>
      );
    case "status": // activity pulse
    default:
      return (
        <svg {...common}>
          <path d="M3 12h4l2 6 4-12 2 6h6" />
        </svg>
      );
  }
}

export function FactsPanel({ facts }: { facts: Fact[] }) {
  if (facts.length === 0) return null;
  return (
    <aside className="rounded-xl border border-border bg-surface-raised p-4">
      <h2 className="mb-4 text-sm font-semibold text-text">Facts</h2>
      <ul className="space-y-1.5">
        {facts.map((f) => {
          const name = ICON_FOR_LABEL[f.label] ?? "default";
          const isBinge = name === "binge";
          return (
            <li key={f.label} className="flex items-center gap-3 py-0.5">
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-lg",
                  isBinge ? "bg-warning/15 text-warning" : "bg-surface-overlay text-text-muted",
                )}
              >
                <Icon name={name} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
                  {f.label}
                </div>
                {f.imageUrl ? (
                  <span className="mt-1 inline-flex h-6 items-center rounded bg-white/95 px-1.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={f.imageUrl}
                      alt={f.value}
                      title={f.value}
                      className="h-4 w-auto max-w-[96px] object-contain"
                    />
                  </span>
                ) : (
                  <div
                    className={cn(
                      "text-sm font-semibold",
                      f.tone === "money" ? "text-success" : isBinge ? "text-warning" : "text-text",
                    )}
                  >
                    {f.value}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
