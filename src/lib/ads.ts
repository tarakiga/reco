// Display-ads plumbing: pure helpers shared by the server reader, the ad-slot
// components, and the admin form. No "server-only" here so the admin client can
// import the placement metadata.
//
// Network-agnostic by design: the admin pastes a loader script URL (AdSense,
// Ezoic, Media.net, …) and, per placement, the network's ad-unit embed HTML.
// Nothing renders unless the master switch is on AND a placement has a snippet,
// so the whole system ships dark and is flipped on later from /admin/ads.

export const ADS_NAMESPACE = "ads";
export const ADS_ENABLED_KEY = "enabled"; // master on/off switch
export const ADS_LOADER_KEY = "loader"; // network loader script URL
export const slotKey = (placement: string) => `slot-${placement}`;

/** A configurable ad placement: the source of truth for both the admin form
 *  and the slot components (which placement keys exist). */
export interface AdPlacement {
  key: string;
  label: string;
  help: string;
}

export const AD_PLACEMENTS: AdPlacement[] = [
  {
    key: "title-inline",
    label: "Title page: below synopsis",
    help: "In-feed unit on a movie/TV page, after the overview text.",
  },
  {
    key: "title-sidebar",
    label: "Title page: sidebar",
    help: "Vertical unit in the right sidebar under the Facts panel.",
  },
  {
    key: "home-feed",
    label: "Home page: in-feed",
    help: "One unit on the home page between the rails.",
  },
  {
    key: "footer",
    label: "Site footer: all pages",
    help: "A horizontal unit above the footer, site-wide.",
  },
];

/** Resolved, validated ads config. Slots resolve to null when unset/blank. */
export interface AdsConfig {
  enabled: boolean;
  loader: string | null;
  slots: Record<string, string | null>;
}
