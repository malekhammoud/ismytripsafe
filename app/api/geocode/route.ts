import { geocode } from "@/lib/data"

export const maxDuration = 60

/**
 * Geocode a small list of place strings (e.g. "Alfama, Lisbon, Portugal") to
 * coordinates so the map page can drop markers on the safe/avoid areas the AI
 * named. Sequential + throttled to stay polite to the free geocoders.
 */
export async function POST(request: Request) {
  let queries: string[] = []
  try {
    const body = await request.json()
    if (Array.isArray(body?.queries)) queries = body.queries
  } catch {
    /* ignore */
  }

  const results: { query: string; lat: number | null; lon: number | null }[] = []
  for (const q of queries.slice(0, 12)) {
    if (typeof q !== "string" || !q.trim()) continue
    const g = await geocode(q).catch(() => null)
    results.push({ query: q, lat: g?.lat ?? null, lon: g?.lon ?? null })
    await new Promise((r) => setTimeout(r, 250))
  }

  return Response.json({ results })
}
