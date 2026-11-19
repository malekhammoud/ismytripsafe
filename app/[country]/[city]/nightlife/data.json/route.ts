import { findNightlife } from "@/lib/nightlife/store"
export const dynamic = "force-dynamic"
export async function GET(_request: Request, { params }: { params: Promise<{ country: string; city: string }> }) {
  const { country, city } = await params, report = await findNightlife(country, city)
  if (!report) return Response.json({ error: "Report not found" }, { status: 404 })
  // Public ODbL derivative export: no proprietary FSQ fields or UGC labels.
  const venues = report.venues.filter(v => v.sources.some(s => s.id === "osm")).map(v => ({ id: v.id, name: v.name, lat: v.lat, lon: v.lon, hours: v.hours, tags: v.tags, sources: v.sources.filter(s => s.id === "osm") }))
  return Response.json({ city: report.city, updatedAt: report.updatedAt, licence: "ODbL 1.0", attribution: "© OpenStreetMap contributors; population: Wikidata CC0", licenceUrl: "https://opendatacommons.org/licenses/odbl/1-0/", venues }, { headers: { "Cache-Control": "public, max-age=3600", "X-Robots-Tag": "noindex" } })
}
