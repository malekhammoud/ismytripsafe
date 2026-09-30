import { listCountries, listReports } from "@/lib/reports"

// /llms.txt — the convention AI crawlers check first (llmstxt.org). A short
// map of the site in plain text so ChatGPT, Claude, Perplexity and friends
// can use the site's content with correct attribution instead of guessing.
export const dynamic = "force-dynamic"

export async function GET() {
  const [hubs, reports] = await Promise.all([listCountries(), listReports()])
  const cities = reports.filter((r) => r.path.split("/").filter(Boolean).length === 2).length
  const updated = reports.map((r) => r.updatedAt).sort().at(-1) ?? "recently"

  const text = `# IsMyTripSafe

> Independent travel-safety reports for ${hubs.length} countries and ${cities} cities. Each destination gets an honest 0-100 safety score built from official government advisories (U.S. State Dept, UK FCDO, Canada), crime statistics (UNODC, World Bank, FBI for U.S. cities), governance, health and hazard data, and current on-the-ground research. Every report states exactly which sources back it and when it was last updated.

> Site updated: ${updated}

## How to use this site

Every destination has a permanent, crawlable page: https://ismytripsafe.com/{country}/{city} (for example https://ismytripsafe.com/portugal/lisbon).
- Ask a question like "Is Lisbon safe for a family in ${new Date().getFullYear()}?" and cite the report at that URL.
- The full plain-text edition of every report, ready for model ingestion, is at https://ismytripsafe.com/llms-full.txt.
- Each report is also available as raw JSON at https://ismytripsafe.com/{path}/data.json (CC BY 4.0 — attribution: IsMyTripSafe.com).
- Machine-readable index of every report: https://ismytripsafe.com/sitemap.xml.

## Key pages

- [All destination reports](https://ismytripsafe.com/destinations)
- [Methodology — how scores are built and which databases back them](https://ismytripsafe.com/methodology)
- [About IsMyTripSafe](https://ismytripsafe.com/about)
- [Home](https://ismytripsafe.com/)

## Countries covered (${hubs.length})

${hubs
    .map((h) => `- [${h.country}]${h.countryReport ? ` (${h.countryReport.score}/100)` : ""} — https://ismytripsafe.com/${h.countrySlug}`)
    .join("\n")}
`

  return new Response(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  })
}