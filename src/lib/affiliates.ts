// Affiliate plumbing — pure helpers shared by the server reader, the frontend
// block, and the admin form. No "server-only" here so the admin client can
// import the field metadata.
//
// The golden rule: a link is only ever built when its tracking id/tag is
// present. Every builder returns null for an empty/missing id, so the frontend
// renders nothing until an admin fills the value in /admin/affiliates.

/** A single configurable affiliate field — the source of truth for both the
 *  admin form (labels/help) and the reader (which keys to read). */
export interface AffiliateField {
  key: string;
  label: string;
  help: string;
  placeholder: string;
}

export const AFFILIATE_FIELDS: AffiliateField[] = [
  {
    key: "amazon",
    label: "Amazon Associates tag",
    help: "Your Amazon Associates tracking tag. Powers “Rent or buy on Amazon” on movie/TV pages.",
    placeholder: "yourtag-20",
  },
  {
    key: "apple",
    label: "Apple Performance Partners token",
    help: "Apple TV affiliate token (the `at` value from Apple’s Performance Partners). Powers “Watch on Apple TV”.",
    placeholder: "1000labc",
  },
  {
    key: "fandango",
    label: "Fandango affiliate code",
    help: "Fandango affiliate/campaign code. Powers “Get tickets” on movies currently in cinemas.",
    placeholder: "your-cmp-code",
  },
  {
    key: "disclosure",
    label: "Disclosure text (optional)",
    help: "Shown beneath affiliate links. Leave blank to use the default FTC-style disclosure.",
    placeholder: "We may earn a commission, at no extra cost to you.",
  },
];

/** Resolved, validated affiliate config. A field is null when unset/blank. */
export interface AffiliateConfig {
  amazonTag: string | null;
  appleToken: string | null;
  fandangoCode: string | null;
  disclosure: string | null;
}

export const DEFAULT_DISCLOSURE =
  "Some links are affiliate links — we may earn a commission, at no extra cost to you.";

const enc = encodeURIComponent;

/** Amazon Prime Video search for the title, tagged with the Associates id.
 *  null without a tag. */
export function amazonSearchUrl(
  title: string,
  year: number | null,
  tag: string | null,
): string | null {
  if (!tag) return null;
  const q = year ? `${title} ${year}` : title;
  return `https://www.amazon.com/s?k=${enc(q)}&i=instant-video&tag=${enc(tag)}`;
}

/** Apple TV search for the title, carrying the Performance Partners token.
 *  null without a token. */
export function appleTvSearchUrl(title: string, token: string | null): string | null {
  if (!token) return null;
  return `https://tv.apple.com/search?term=${enc(title)}&at=${enc(token)}`;
}

/** Fandango ticket search for the title, carrying the affiliate code.
 *  null without a code. */
export function fandangoTicketsUrl(title: string, code: string | null): string | null {
  if (!code) return null;
  return `https://www.fandango.com/search?q=${enc(title)}&cmp=${enc(code)}`;
}
