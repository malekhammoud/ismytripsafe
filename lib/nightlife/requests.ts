// City requests for nightlife reports.
//
// A visitor can ask for a city we have not mapped. The request is not a
// promise to publish: the research pipeline decides whether a city has
// enough venues to say anything honest about. What the queue guarantees is
// that the ask is kept, deduplicated, and picked up by the next batch before
// routine refreshes — a person should not have to email and hope.
//
// Records live under `NIGHTLIFE_CACHE_DIR/requests`, one small JSON file per
// safety-cache key, so a repeat request updates the same file rather than
// growing a log. The batch process marks them done with the outcome it
// reached (published / limited / withheld).
import { promises as fs } from "node:fs"
import { createHash } from "node:crypto"
import path from "node:path"
import { NIGHTLIFE_DIR, safeKey, writeJson } from "./store"

export const REQUESTS_DIR = path.join(NIGHTLIFE_DIR, "requests")
const RATE_DIR = path.join(REQUESTS_DIR, ".rate")

export type RequestOutcome = "full" | "limited" | "withheld"

export interface NightlifeRequest {
  version: 1
  /** The safety-cache key, e.g. `de_munich`. */
  key: string
  /** Safety report path, e.g. `/germany/munich`. */
  path: string
  city: string
  country: string
  requestedAt: string
  lastRequestedAt: string
  count: number
  note?: string
  status: "pending" | "done"
  completedAt?: string
  outcome?: RequestOutcome
}

const fileFor = (key: string) => path.join(REQUESTS_DIR, `${safeKey(key)}.json`)

export async function readNightlifeRequest(key: string): Promise<NightlifeRequest | null> {
  try {
    return JSON.parse(await fs.readFile(fileFor(key), "utf8")) as NightlifeRequest
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT" || error instanceof SyntaxError) return null
    throw error
  }
}

export async function queueNightlifeRequest(
  meta: { key: string; path: string; city: string; country: string },
  note?: string,
): Promise<{ request: NightlifeRequest; already: boolean }> {
  const now = new Date().toISOString()
  const existing = await readNightlifeRequest(meta.key)

  // A finished request only comes back to life if the report is no longer
  // there; the API checks that before calling this.
  const request: NightlifeRequest = existing
    ? {
        ...existing,
        lastRequestedAt: now,
        count: existing.count + 1,
        note: note ?? existing.note,
        status: "pending",
        completedAt: undefined,
        outcome: undefined,
      }
    : {
        version: 1,
        key: meta.key,
        path: meta.path,
        city: meta.city,
        country: meta.country,
        requestedAt: now,
        lastRequestedAt: now,
        count: 1,
        status: "pending",
        ...(note ? { note } : {}),
      }

  await writeJson(fileFor(meta.key), request)
  return { request, already: !!existing && existing.status === "pending" }
}

/** Pending asks, oldest first, so the queue is fair. */
export async function listNightlifeRequests(status: "pending" | "done" | "all" = "pending"): Promise<NightlifeRequest[]> {
  let names: string[]
  try {
    names = await fs.readdir(REQUESTS_DIR)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return []
    throw error
  }
  const records = await Promise.all(
    names
      .filter((name) => /^[a-z0-9][a-z0-9_-]*\.json$/.test(name))
      .map(async (name) => {
        try {
          return JSON.parse(await fs.readFile(path.join(REQUESTS_DIR, name), "utf8")) as NightlifeRequest
        } catch {
          return null
        }
      }),
  )
  return records
    .filter((r): r is NightlifeRequest => !!r && (status === "all" || r.status === status))
    .sort((a, b) => a.requestedAt.localeCompare(b.requestedAt))
}

/**
 * Does this outcome answer the ask?
 *
 * A published (full/limited) report always does. A withheld report only does
 * when its sources were healthy — otherwise it is an outage dressed as a
 * verdict, and the request should stay in the queue for another run.
 */
export function requestAnswered(outcome: RequestOutcome, sourceFailed: boolean): boolean {
  return outcome !== "withheld" || !sourceFailed
}

export async function completeNightlifeRequest(key: string, outcome: RequestOutcome): Promise<void> {
  const existing = await readNightlifeRequest(key)
  if (!existing) return
  await writeJson(fileFor(key), {
    ...existing,
    status: "done",
    completedAt: new Date().toISOString(),
    outcome,
  } satisfies NightlifeRequest)
}

/** Total asks in the last 24 hours — a ceiling for the public endpoint. */
export async function countRequestsSince(sinceMs: number): Promise<number> {
  const all = await listNightlifeRequests("all")
  const cutoff = new Date(sinceMs).toISOString()
  return all.filter((r) => r.lastRequestedAt >= cutoff).length
}

/**
 * One bucket per hashed IP. Eight asks per ten minutes is far above what a
 * person needs and far below what a script wants. The IP is never stored.
 */
export function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex").slice(0, 32)
}

export async function noteRequestAttempt(ipHash: string, limit = 8, windowMs = 10 * 60_000): Promise<{ allowed: boolean; retryAfter: number }> {
  const now = Date.now()
  const file = path.join(RATE_DIR, `${safeKey(ipHash)}.json`)
  let times: number[] = []
  try {
    const parsed = JSON.parse(await fs.readFile(file, "utf8")) as { times?: unknown }
    if (Array.isArray(parsed.times)) times = parsed.times.filter((t): t is number => typeof t === "number")
  } catch {
    /* new bucket */
  }
  times = times.filter((t) => now - t < windowMs)
  if (times.length >= limit) {
    return { allowed: false, retryAfter: Math.ceil((windowMs - (now - times[0])) / 1000) }
  }
  times.push(now)
  await writeJson(file, { times })
  return { allowed: true, retryAfter: 0 }
}
