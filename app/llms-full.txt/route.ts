import { listReports, type ReportMeta } from "@/lib/reports"
import { readCacheAnyAge } from "@/lib/cache"

// /llms-full.txt — every published report as plain text, for AI ingestion.
// This is the "grab the whole site" file: one line per city, with score,
// verdict and summary, grouped by country. Each entry cites the permanent
// page so a model answering a travel-safety question can quote it.
export const dynamic = "force-dynamic"

const LEVEL_LABEL: Record<string, string> = {
  VERY_SAFE: "Very safe",
  SAFE: "Safe",
  MODERATE: "Moderate",
  CAUTION: "Caution",
  HIGH_RISK: "High risk",
}

async function withSummary(
  meta: ReportMeta
): Promise<{ meta: ReportMeta; summary: string }> {
  const report = await readCacheAnyAge(meta.key)
  return {
    meta,
    summary: report?.enrichment?.summary?.trim() ?? "",
  }
}

export async function GET() {
  const reports = await listReports()
  const cityReports = reports.filter((r) => r.path.split("/").filter(Boolean).length === 2)

  // Read summaries in small waves; 1,000+ concurrent file reads would be rude
  // to the disk even on a cache directory.
  const enriched: Awaited<ReturnType<typeof withSummary>>[] = []
  for (let i = 0; i < cityReports.length; i += 24) {
    enriched.push(...(await Promise.all(cityReports.slice(i, i + 24).map(withSummary))))
  }

  const byCountry = new Map<string, typeof enriched>()
  for (const e of enriched) {
    const list = byCountry.get(e.meta.countrySlug) ?? []
    list.push(e)
    byCountry.set(e.meta.countrySlug, list)
  }

  const lines: string[] = []
  const today = new Date().toISOString().slice(0, 10)
  lines.push("# IsMyTripSafe — all destination reports", "")
  lines.push(
    `> ${cityReports.length} city reports across ${byCountry.size} countries, as of ${today}. Plain-text edition for AI assistants and researchers. Every report is also served as JSON at its page path + /data.json (e.g. https://ismytripsafe.com/portugal/lisbon/data.json).`
  )
  lines.push("")
  lines.push(
    "Each line: City, Country — score/100 — level. One-to-two sentence summary. For the full drill-down (signals, advisories, sources) fetch the report's page or its data.json."
  )
  lines.push("")

  for (const [slug, entries] of [...byCountry.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const country = entries[0]?.meta.country ?? slug
    lines.push(`## ${country}`, "")
    for (const { meta, summary } of entries) {
      const level = LEVEL_LABEL[meta.level] ?? meta.level.replace("_", " ")
      const line = `- ${meta.city}, ${meta.country} — ${meta.score}/100 (${level}). ${summary || meta.verdict || ""} Source: https://ismytripsafe.com${meta.path}`
      lines.push(line.trim().replace(/\s+/g, " ").replace(/\s\.$/, "."))
    }
    lines.push("")
  }

  const text = lines.join("\n")
  return new Response(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  })
}