// ─── Search-result copy for country hubs ─────────────────────────────
//
// The shared country-hub title ("Is {country} Safe in {year}? Advisories,
// Crime Data & City Scores") is accurate but runs past the ~60-character
// width the layout's " | IsMyTripSafe" suffix allows once the country name
// is long. This override shortens only the <title> for the affected hub;
// the visible page, its facts and the shared meta description are untouched.
//
// Paths are canonical and lowercase, and must match `/{countrySlug}`.

const TITLES: Record<string, string> = {
  // The shared title renders, with the site suffix, at 79 characters.
  "/kyrgyzstan": "Is Kyrgyzstan Safe in {year}? Crime & Safety",
}

/** Shortened title for a treatment country hub, or null for the shared template. */
export function countryTitleOverride(
  path: string,
  { year }: { year: number | string }
): string | null {
  const template = TITLES[path.toLowerCase()]
  if (!template) return null
  return template.replace(/\{year\}/g, String(year))
}
