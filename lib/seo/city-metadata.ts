// ─── Search-result copy for city reports ─────────────────────────────
//
// A handful of city reports rank on page one but earn almost no clicks:
// the shared template ("Is {city} Safe in {year}? Safety Score {n}/100")
// describes the page accurately but does not answer the question each
// page is actually found for. These overrides rewrite only the <title>
// and meta description. The visible report, its score and its data are
// untouched.
//
// Rules for every entry:
//   · title ≤ 60 characters once the layout's " | IsMyTripSafe" suffix is
//     added, so the raw title stays at 45 or fewer (the layout appends 15)
//   · description 140–160 characters for any score width
//   · {year} and {score} come from the report itself — no invented facts
//   · {score} is the city's own final index, so attribute it to the city:
//     "Malmö's safety score", never "Sweden Safety Score"
//
// Paths are canonical, lowercase, and must match `meta.path`.

interface MetadataTemplate {
  title: string
  description: string
}

const TEMPLATES: Record<string, MetadataTemplate> = {
  "/united-states/los-angeles": {
    title: "Is Los Angeles Safe in {year}? Crime & Safety",
    description:
      "Los Angeles safety score is {score}/100 in {year}. Compare current crime rates, areas to avoid, scams and live US travel advisories for Los Angeles.",
  },
  "/australia/melbourne": {
    title: "Is Melbourne Safe? {year} Crime & Safety Score",
    description:
      "Is Melbourne safe in {year}? Safety score {score}/100, local crime rates, areas to avoid, scams and live Australian safety advisories for Melbourne.",
  },
  "/sweden/malmo": {
    title: "Is Malmö Dangerous? Malmö Safety Score {year}",
    description:
      "Is Malmö dangerous in {year}? Malmö's safety score is {score}/100, with local crime rates, areas to avoid, scams and live travel advisories for Malmö, Sweden.",
  },
  "/french-polynesia/bora-bora": {
    title: "Bora Bora Safety Index {score}/100: Safe in {year}?",
    description:
      "Bora Bora safety index is {score}/100 in {year}. Compare crime, health and weather risks, scams and French Polynesia travel advisories for Bora Bora.",
  },
  "/germany/dusseldorf": {
    title: "Is Düsseldorf Safe? {year} Crime & Safety Score",
    description:
      "Is Düsseldorf safe in {year}? Safety score {score}/100, current crime rates, areas to avoid, scams and live German travel advisories for Düsseldorf.",
  },
  "/norway/troms": {
    title: "Is Tromsø Safe? {year} Crime & Safety Score",
    description:
      "Is Tromsø safe in {year}? Safety score {score}/100, current local crime rates, areas to avoid, scams and live Norwegian safety advisories for Tromsø.",
  },
  "/philippines/cebu-city": {
    title: "Is Cebu City Safe? {year} Tourist Safety Score",
    description:
      "Is Cebu City safe in {year}? Safety score {score}/100, local crime rates, tourist areas to avoid, scams and live Philippine travel advisories for Cebu.",
  },
  "/puerto-rico/rincon": {
    title: "Is Rincón Safe? {year} Crime & Safety Score",
    description:
      "Is Rincón safe in {year}? Safety score {score}/100, current local crime rates, areas to avoid, scams and live Puerto Rico safety advisories for Rincón.",
  },
  "/spain/barcelona": {
    title: "Barcelona Crime Rate {year}: Is Barcelona Safe?",
    description:
      "Barcelona crime rate and safety score {score}/100 in {year}. Compare pickpocket hotspots, areas to avoid, scams and live Spanish travel advisories for Barcelona.",
  },
  "/india/hyderabad": {
    title: "Is Hyderabad Safe? {year} Alerts & Safety Score",
    description:
      "Is Hyderabad safe in {year}? Safety score {score}/100, current city crime rates, areas to avoid, scams and live Indian travel advisories for Hyderabad.",
  },
}

export interface CityMetadataCopy {
  title: string
  description: string
}

/** Word-boundary safety net; the curated templates are already under 160. */
function fitDescription(text: string): string {
  if (text.length <= 160) return text
  const cut = text.slice(0, 160)
  const lastSpace = cut.lastIndexOf(" ")
  const end = lastSpace > 140 ? lastSpace : 159
  return `${cut.slice(0, end).replace(/[,;:.!?]$/, "")}.`
}

/**
 * Rewritten search-result copy for a treatment page, or null when the
 * page should keep the site-wide report template.
 */
export function cityMetadataOverride(
  path: string,
  { year, score }: { year: number | string; score: number | string }
): CityMetadataCopy | null {
  const template = TEMPLATES[path.toLowerCase()]
  if (!template) return null

  const fill = (text: string) =>
    text.replace(/\{year\}/g, String(year)).replace(/\{score\}/g, String(score))

  return {
    title: fill(template.title),
    description: fitDescription(fill(template.description)),
  }
}
