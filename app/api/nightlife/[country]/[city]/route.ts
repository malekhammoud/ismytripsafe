import { after } from "next/server"
import { getCityReport } from "@/lib/reports"
import { visitJobs } from "@/lib/nightlife/visits"
export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 300
type Context = { params: Promise<{ country: string; city: string }> }
async function resolve({ params }: Context) {
  const { country, city } = await params
  if (!/^[a-z0-9][a-z0-9-]{0,100}$/.test(country) || !/^[a-z0-9][a-z0-9-]{0,100}$/.test(city)) return null
  return getCityReport(country, city)
}
const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" }
export async function GET(_request: Request, context: Context) {
  const hit = await resolve(context)
  if (!hit) return Response.json({ error: "City not found" }, { status: 404, headers })
  return Response.json(await visitJobs.inspect(hit.meta.key), { headers })
}
export async function POST(request: Request, context: Context) {
  // Visits are same-origin; link previews and GET prefetches cannot spend quota.
  if (request.headers.get("sec-fetch-site") === "cross-site") return Response.json({ error: "Same-origin requests only" }, { status: 403, headers })
  const origin = request.headers.get("origin"), host = request.headers.get("host") ?? new URL(request.url).host
  if (origin) {
    try { if (new URL(origin).host !== host) return Response.json({ error: "Same-origin requests only" }, { status: 403, headers }) }
    catch { return Response.json({ error: "Invalid origin" }, { status: 403, headers }) }
  }
  const hit = await resolve(context)
  if (!hit) return Response.json({ error: "City not found" }, { status: 404, headers })
  const job = await visitJobs.prepare(hit)
  if (job.run) after(job.run)
  return Response.json(job.status, { status: job.status.state === "running" ? 202 : 200, headers: { ...headers, ...(job.status.retryAfter ? { "Retry-After": String(job.status.retryAfter) } : {}) } })
}
