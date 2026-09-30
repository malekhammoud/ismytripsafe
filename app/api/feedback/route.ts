import { mkdir, appendFile } from "node:fs/promises"
import path from "node:path"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

// Feedback lands as one JSON line per submission, outside the repo so deploys
// never wipe it. Grouped by month so any of them can be read, exported or
// deleted without touching the rest.
const FEEDBACK_DIR = process.env.FEEDBACK_DIR || "/var/lib/ismytripsafe/feedback"

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      rating?: unknown
      comment?: unknown
      place?: unknown
      page?: unknown
    } | null

    const rating = Number(body?.rating)
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ ok: false, error: "rating must be a whole number from 1 to 5" }, { status: 400 })
    }

    const line =
      JSON.stringify({
        ts: new Date().toISOString(),
        rating,
        comment: typeof body?.comment === "string" ? body.comment.trim().slice(0, 2000) : "",
        place: typeof body?.place === "string" ? body.place.trim().slice(0, 120) : "",
        page: typeof body?.page === "string" ? body.page.trim().slice(0, 200) : "",
      }) + "\n"

    const month = new Date().toISOString().slice(0, 7) // YYYY-MM
    await mkdir(FEEDBACK_DIR, { recursive: true })
    await appendFile(path.join(FEEDBACK_DIR, `${month}.jsonl`), line, "utf8")

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}