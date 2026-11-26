// ─── Search-result copy for city reports ─────────────────────────────
//
// Some city reports rank on page one but earn almost no clicks:
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
  // Second cohort (Nov 2026): page-one reports with high impressions and
  // near-zero CTR. Each title answers the query the page is found for.
  "/malaysia/langkawi": {
    title: "Is Langkawi Safe to Visit? {year} Safety Report",
    description:
      "Is Langkawi safe to visit in {year}? Safety score {score}/100, current crime data, areas to avoid, scams and live Malaysian travel advisories for Langkawi.",
  },
  "/malaysia/johor-bahru": {
    title: "Is It Safe to Travel to Johor Bahru? {year}",
    description:
      "Is it safe to travel to Johor Bahru in {year}? Safety score {score}/100, local crime rates, areas to avoid, scams and Malaysian travel advisories for Johor Bahru.",
  },
  "/hungary/budapest": {
    title: "Budapest Crime Rate {year}: Is Budapest Safe?",
    description:
      "Budapest crime rate and safety score {score}/100 in {year}. Compare local crime hotspots, areas to avoid, scams and live Hungarian travel advisories for Budapest.",
  },
  "/brazil/sao-luis": {
    title: "Is São Luís Safe? {year} Crime & Safety Score",
    description:
      "Is São Luís safe in {year}? Safety score {score}/100, current local crime rates, areas to avoid, scams and live Brazilian travel advisories for São Luís.",
  },
  "/india/darjeeling": {
    title: "Is Darjeeling Safe? {year} Crime & Safety Score",
    description:
      "Is Darjeeling safe in {year}? Safety score {score}/100, current local crime rates, areas to avoid, scams and live Indian travel advisories for Darjeeling.",
  },
  "/finland/rovaniemi": {
    title: "Rovaniemi Weather Forecast & Safety {year}",
    description:
      "Rovaniemi weather and safety in {year}: safety score {score}/100, the weather forecast, local crime, scams and live Finnish travel advisories for Rovaniemi.",
  },
  "/italy/lecce": {
    title: "Is Lecce Italy Safe? {year} Safety Score",
    description:
      "Is Lecce, Italy safe in {year}? Safety score {score}/100, current crime rates, areas to avoid, scams and live Italian travel advisories for Lecce, Puglia.",
  },
  "/united-states/jersey-city": {
    title: "Is Jersey City Safe in {year}? Crime & Safety",
    description:
      "Is Jersey City safe in {year}? Safety score {score}/100, current local crime rates, areas to avoid, scams and live US travel advisories for Jersey City.",
  },
  "/china/chengdu": {
    title: "Is Chengdu Safe? {year} Crime & Safety Score",
    description:
      "Is Chengdu safe in {year}? Safety score {score}/100, current local crime rates, areas to avoid, scams and live Chinese travel advisories for Chengdu, Sichuan.",
  },
  "/portugal/faro": {
    title: "Is Faro Safe? {year} Crime & Safety Score",
    description:
      "Is Faro safe in {year}? Safety score {score}/100, current local crime rates, areas to avoid, scams and live Portuguese travel advisories for Faro, Algarve.",
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

// Build-time guard: the city report route imports this module while
// `next build` prerenders reports, so malformed search-result copy fails the
// build instead of shipping. tests/seo-metadata-overrides.test.cjs covers the
// same contract under `npm run test:nightlife`.
function assertSearchCopyFits(): void {
  const suffix = " | IsMyTripSafe"
  const sampleYear = String(new Date().getFullYear())
  for (const [path, template] of Object.entries(TEMPLATES)) {
    for (const score of [0, 100]) {
      const title = template.title
        .replace(/\{year\}/g, sampleYear)
        .replace(/\{score\}/g, String(score))
      if (title.length + suffix.length > 60) {
        throw new Error(`${path} title exceeds 60 chars with site suffix: "${title}"`)
      }
      const description = fitDescription(
        template.description
          .replace(/\{year\}/g, sampleYear)
          .replace(/\{score\}/g, String(score))
      )
      if (description.length < 140 || description.length > 160) {
        throw new Error(`${path} description is ${description.length} chars, expected 140-160`)
      }
      if (title.includes("{") || description.includes("{")) {
        throw new Error(`${path} has an unfilled metadata token`)
      }
    }
  }
}

assertSearchCopyFits()

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
