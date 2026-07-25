import { getCityReport } from "@/lib/reports"
import {
  computeCategories,
  computeFinalScore,
  FIELD_RESEARCH_WEIGHT,
  LEVELS,
} from "@/lib/safety-display"
import { absUrl } from "@/lib/site"

export const dynamic = "force-dynamic"

/**
 * Machine-readable safety data for one destination — the DataDownload behind
 * each report's Dataset markup, and a friendly endpoint for researchers and
 * AI agents. CC BY 4.0: reuse with attribution to ismytripsafe.com.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ country: string; city: string }> }
) {
  const { country, city } = await params
  const hit = await getCityReport(country.toLowerCase(), city.toLowerCase())
  if (!hit) {
    return Response.json({ error: "No report for this destination" }, { status: 404 })
  }
  const { report, meta } = hit
  const s = report.bundle.safety
  const final = computeFinalScore(s, report.enrichment)

  return Response.json(
    {
      license: "CC BY 4.0 — attribution: IsMyTripSafe.com",
      source: absUrl(meta.path),
      updatedAt: report.cachedAt,
      place: {
        city: meta.city,
        country: meta.country,
        countryCode: meta.countryCode,
        lat: meta.lat,
        lon: meta.lon,
      },
      safety: {
        score: final.index,
        level: final.level,
        answer: LEVELS[final.level].answer,
        saferThanPctOfCountries: final.saferThanPct,
        confidence: final.confidence,
        caps: final.caps,
        // the database-only composite, before the traveller-sentiment term
        databaseScore: final.baseIndex,
        travellerSentiment: {
          score: final.sentiment.score,
          label: final.sentiment.label,
          summary: final.sentiment.summary,
          weightInScore: final.includesFieldResearch ? FIELD_RESEARCH_WEIGHT : 0,
          components: final.sentiment.parts.map((p) => ({
            label: p.label,
            score: p.score,
            weight: p.weight,
          })),
        },
        categories: computeCategories(s.signals, report.enrichment).map((c) => ({
          key: c.key,
          label: c.label,
          score: c.score,
          tier: c.tier,
        })),
      },
      advisories: s.advisories.map((a) => ({
        source: a.source,
        level: a.level,
        label: a.levelLabel,
        updated: a.updated,
        url: a.url,
      })),
      indicators: s.signals
        .filter((sig) => sig.score != null)
        .map((sig) => ({
          key: sig.key,
          label: sig.label,
          value: sig.value,
          display: sig.display,
          year: sig.year,
          score: sig.score,
          source: sig.source,
        })),
      healthNotices: s.health.map((h) => ({
        level: h.levelLabel,
        title: h.title,
        url: h.url,
      })),
      hazardAlerts: (s.hazardEvents ?? []).map((h) => ({
        kind: h.kind,
        severity: h.severity,
        title: h.title,
        distanceKm: h.distanceKm,
      })),
      fieldResearch: {
        verdict: report.enrichment.verdict,
        summary: report.enrichment.summary,
        robberyRisk: report.enrichment.robbery ?? null,
        pickpocketRisk: report.enrichment.pickpocket ?? null,
        safeAreas: report.enrichment.safeAreas,
        avoidAreas: report.enrichment.avoidAreas,
        scams: report.enrichment.scams,
        zones: report.enrichment.mapZones ?? [],
      },
    },
    {
      headers: {
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
      },
    }
  )
}
