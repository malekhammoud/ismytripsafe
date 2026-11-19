import { after } from "next/server"
import { getCityReport } from "@/lib/reports"
import { visitJobs } from "@/lib/nightlife/visits"
import { findNightlife, readNightlife } from "@/lib/nightlife/store"
import {
  completeNightlifeRequest,
  countRequestsSince,
  hashIp,
  noteRequestAttempt,
  queueNightlifeRequest,
} from "@/lib/nightlife/requests"

// A public intake for city requests.
//
// Two things happen, in this order:
//
//   1. The ask is written to a durable queue, so it survives a busy pipeline
//      and is picked up by the nightly batch ahead of routine refreshes.
//   2. If the on-demand budget allows, research starts immediately through
//      the same coordinator the city page uses. The visitor can follow it on
//      the city page while it runs.
//
// The queue is what makes this a request rather than a button that may or may
// not have worked. The immediate build is what makes it feel like an answer.
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const HEADERS = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex",
}

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: HEADERS })

const DAY = 24 * 60 * 60_000
/** New cities a day across the whole site. The nightly batch takes 25. */
const DAILY_CAP = 40

export async function POST(request: Request) {
  // Same-origin only. A request form is not a place for cross-site writes.
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return json({ ok: false, status: "forbidden" }, 403)
  }
  const origin = request.headers.get("origin")
  const host = request.headers.get("host") ?? new URL(request.url).host
  if (origin) {
    try {
      if (new URL(origin).host !== host) return json({ ok: false, status: "forbidden" }, 403)
    } catch {
      return json({ ok: false, status: "forbidden" }, 403)
    }
  }

  const body = (await request.json().catch(() => null)) as {
    path?: unknown
    note?: unknown
    company?: unknown
  } | null

  // Honeypot. Answer as if it worked so a bot learns nothing.
  if (typeof body?.company === "string" && body.company.trim()) {
    return json({ ok: true, status: "queued" })
  }

  const path = typeof body?.path === "string" ? body.path.trim() : ""
  if (!/^\/[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*$/.test(path)) {
    return json({ ok: false, status: "invalid", message: "Choose a city from the list." }, 400)
  }

  const [countrySlug, citySlug] = path.slice(1).split("/")
  const hit = await getCityReport(countrySlug, citySlug)
  if (!hit) {
    return json(
      { ok: false, status: "unknown-city", message: "We do not have a safety report for that city yet." },
      404,
    )
  }
  const { meta } = hit

  const published = await findNightlife(meta.countrySlug, meta.citySlug)
  if (published) {
    return json({
      ok: true,
      status: "published",
      city: meta.city,
      country: meta.country,
      href: `${meta.path}/nightlife`,
    })
  }

  // A withheld report is a considered answer ("we looked and could not find
  // enough"), not a missing one. Queueing it again every night would be a
  // silent promise we know we cannot keep.
  const checked = await readNightlife(meta.key)
  if (checked && checked.outcome === "withheld") {
    return json({
      ok: false,
      status: "unavailable",
      city: meta.city,
      country: meta.country,
      message: "We checked this city and could not find enough venues to publish an honest guide.",
    })
  }

  const recent = await countRequestsSince(Date.now() - DAY)
  if (recent >= DAILY_CAP) {
    return json(
      { ok: false, status: "queue-full", message: "The request queue is full for today. Try again tomorrow." },
      429,
    )
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  const rate = await noteRequestAttempt(hashIp(ip), 4)
  if (!rate.allowed) {
    return json(
      {
        ok: false,
        status: "rate-limited",
        message: "That is a lot of requests from here. Try again in a few minutes.",
        retryAfter: rate.retryAfter,
      },
      429,
    )
  }

  const note =
    typeof body?.note === "string"
      ? body.note.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 280)
      : ""

  const { request: queued, already } = await queueNightlifeRequest(
    { key: meta.key, path: meta.path, city: meta.city, country: meta.country },
    note || undefined,
  )

  // Start now if the shared on-demand budget has room. `prepare` is
  // idempotent: a running or recently finished build returns its status and
  // no run callback, and a full budget returns `deferred`.
  const job = await visitJobs.prepare(hit)
  if (job.run) {
    after(async () => {
      await job.run!()
      const report = await readNightlife(meta.key)
      if (report) await completeNightlifeRequest(meta.key, report.outcome)
    })
  }

  return json(
    {
      ok: true,
      status: already ? "already-queued" : "queued",
      research: job.status.state,
      city: queued.city,
      country: queued.country,
      href: `${meta.path}/nightlife`,
      requestedAt: queued.requestedAt,
    },
    already ? 200 : 202,
  )
}
