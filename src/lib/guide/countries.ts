// Countries selectable in the TV guide. TVmaze keys schedules by ISO 3166-1
// alpha-2 code; coverage varies (US/GB richest, many have little or none), so
// the UI shows "no listings" rather than hiding empties.
export interface GuideCountry {
  code: string;
  name: string;
}

export const GUIDE_COUNTRIES: GuideCountry[] = [
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "NZ", name: "New Zealand" },
  { code: "IE", name: "Ireland" },
  { code: "KR", name: "South Korea" },
  { code: "JP", name: "Japan" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "ES", name: "Spain" },
  { code: "IT", name: "Italy" },
  { code: "NL", name: "Netherlands" },
  { code: "BE", name: "Belgium" },
  { code: "SE", name: "Sweden" },
  { code: "NO", name: "Norway" },
  { code: "DK", name: "Denmark" },
  { code: "FI", name: "Finland" },
  { code: "PT", name: "Portugal" },
  { code: "PL", name: "Poland" },
  { code: "TR", name: "Turkey" },
  { code: "BR", name: "Brazil" },
  { code: "MX", name: "Mexico" },
  { code: "IN", name: "India" },
];

// Pluto TV free-streaming regions, shown as a separate group in the picker.
// Codes carry a PLUTO_ prefix so the API routes them to the Pluto source.
export const GUIDE_PLUTO: GuideCountry[] = [
  { code: "PLUTO_US", name: "Pluto TV (US)" },
  { code: "PLUTO_UK", name: "Pluto TV (UK)" },
  { code: "PLUTO_CA", name: "Pluto TV (Canada)" },
  { code: "PLUTO_AU", name: "Pluto TV (Australia)" },
  { code: "PLUTO_DE", name: "Pluto TV (Germany)" },
  { code: "PLUTO_FR", name: "Pluto TV (France)" },
  { code: "PLUTO_ES", name: "Pluto TV (Spain)" },
  { code: "PLUTO_IT", name: "Pluto TV (Italy)" },
  { code: "PLUTO_BR", name: "Pluto TV (Brazil)" },
];

export const DEFAULT_GUIDE_COUNTRY = "US";

export function guideCountryName(code: string): string {
  return GUIDE_COUNTRIES.find((c) => c.code === code.toUpperCase())?.name ?? code;
}
