import { promises as fs } from "node:fs"
import path from "node:path"
import { randomUUID } from "node:crypto"
import type { CachedReport } from "../cache"
import type { ReportMeta } from "../reports"
import { buildNightlife } from "./build"
import { FORMULA_VERSION } from "./scoring"
import { NIGHTLIFE_DIR, readNightlife, safeKey, writeJson } from "./store"
import type { City, NightlifeReport } from "./types"
import type { BuildPhase, VisitStatus } from "./visit-types"
export type CitySafety = { report: CachedReport; meta: ReportMeta }
const DAY = 86400000
const LEASE_MS = 15 * 60 * 1000
const ERROR_COOLDOWN_MS = 10 * 60 * 1000
interface Job { state: "running" | "ready" | "unavailable" | "failed"; updatedAt: string; retryAt?: string; phase?: BuildPhase }
interface Dependencies {
  directory: string
  now: () => number
  read: (key: string) => Promise<NightlifeReport | null>
  build: typeof buildNightlife
  limit: number
}
export function cityFromSafety({ meta }: CitySafety): City {
  return { key: meta.key, city: meta.city, country: meta.country, countryCode: meta.countryCode, countrySlug: meta.countrySlug, citySlug: meta.citySlug, safetyPath: meta.path, lat: meta.lat, lon: meta.lon, wikidataId: null, population: null, populationDate: null, relationId: null, boundaryVerified: false }
}
export function needsNightlifeRefresh(r: NightlifeReport, now = Date.now()) {
  const older = (date: string, days: number) => !date || !Number.isFinite(Date.parse(date)) || now - Date.parse(date) >= days * DAY
  return r.sources.some(s => s.status === "error") || r.formulaVersion !== FORMULA_VERSION || older(r.refresh.venues, 30) || older(r.refresh.population, 180) || older(r.updatedAt, 30)
    || (!!process.env.TICKETMASTER_API_KEY && older(r.refresh.events, 7))
    || (!!process.env.NUMBEO_API_KEY && process.env.NUMBEO_STORAGE_LICENSED === "1" && older(r.refresh.beer, 180))
}
async function readJson<T>(file: string): Promise<T | null> {
  try { return JSON.parse(await fs.readFile(file, "utf8")) as T }
  catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return null; throw e }
}
export function createVisitJobs(overrides: Partial<Dependencies> = {}) {
  const configuredLimit = Number(process.env.NIGHTLIFE_ON_DEMAND_DAILY_LIMIT) || (process.env.OVERPASS_URL ? 100 : 10)
  const deps: Dependencies = { directory: NIGHTLIFE_DIR, now: Date.now, read: readNightlife, build: buildNightlife, limit: Math.max(1, Math.min(1000, configuredLimit)), ...overrides }
  const jobs = path.join(deps.directory, "jobs")
  const fileFor = (key: string) => path.join(jobs, `${safeKey(key)}.json`)
  const iso = () => new Date(deps.now()).toISOString()
  const published = (r: NightlifeReport | null) => !!r && r.outcome !== "withheld"
  async function release(file: string, token: string) {
    const lock = await readJson<{ token: string }>(file)
    if (lock?.token === token) await fs.unlink(file).catch(e => { if (e.code !== "ENOENT") throw e })
  }
  async function claim(file: string, token: string): Promise<boolean> {
    await fs.mkdir(path.dirname(file), { recursive: true })
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const handle = await fs.open(file, "wx", 0o600)
        try { await handle.writeFile(JSON.stringify({ token, at: iso() })) } finally { await handle.close() }
        return true
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e
        try {
          const stat = await fs.stat(file)
          if (deps.now() - stat.mtimeMs < LEASE_MS) return false
          await fs.unlink(file)
        } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error }
      }
    }
    return false
  }
  async function inspect(key: string): Promise<VisitStatus> {
    const [report, job] = await Promise.all([deps.read(key), readJson<Job>(fileFor(key))])
    const available = published(report)
    if (job?.state === "running" && deps.now() - Date.parse(job.updatedAt) < LEASE_MS) return { state: "running", available, phase: job.phase, retryAfter: 3 }
    if (job?.retryAt && Date.parse(job.retryAt) > deps.now()) return { state: job.state === "unavailable" ? "unavailable" : "failed", available, retryAfter: Math.ceil((Date.parse(job.retryAt) - deps.now()) / 1000) }
    if (available && report && !needsNightlifeRefresh(report, deps.now())) return { state: "ready", available: true, updatedAt: report.updatedAt }
    // A genuine thin-data result is retried daily; outages use the shorter job cooldown.
    if (report?.outcome === "withheld" && !report.sources.some(s => s.status === "error") && deps.now() - Date.parse(report.updatedAt) < DAY) return { state: "unavailable", available: false, retryAfter: Math.max(1, Math.ceil((DAY - (deps.now() - Date.parse(report.updatedAt))) / 1000)) }
    return { state: "idle", available }
  }
  async function prepare(hit: CitySafety): Promise<{ status: VisitStatus; run?: () => Promise<void> }> {
    const key = safeKey(hit.meta.key), status = await inspect(key)
    if (status.state !== "idle") return { status }
    const token = randomUUID(), globalLock = path.join(jobs, "research.lock")
    if (!await claim(globalLock, token)) return { status: { state: "busy", available: status.available, retryAfter: 5 } }
    let ownsLock = true
    try {
      // A second process can have completed this city between inspect and claim.
      const fresh = await inspect(key)
      if (fresh.state !== "idle") return { status: fresh }
      const date = iso().slice(0, 10), budgetFile = path.join(jobs, `budget-${date}.json`)
      const budget = await readJson<{ attempts: number }>(budgetFile) ?? { attempts: 0 }
      if (budget.attempts >= deps.limit) {
        const tomorrow = Date.parse(`${date}T00:00:00Z`) + DAY
        return { status: { state: "deferred", available: status.available, retryAfter: Math.ceil((tomorrow - deps.now()) / 1000) } }
      }
      await writeJson(budgetFile, { attempts: budget.attempts + 1 })
      await writeJson(fileFor(key), { state: "running", phase: "resolve", updatedAt: iso() } satisfies Job)
      let started = false
      const run = async () => {
        if (started) return
        started = true
        const heartbeat = setInterval(() => { const now = new Date(); void fs.utimes(globalLock, now, now).catch(() => {}) }, 30000)
        heartbeat.unref()
        try {
          const onProgress = async (phase: BuildPhase) => { await writeJson(fileFor(key), { state: "running", phase, updatedAt: iso() } satisfies Job) }
          const report = await deps.build(cityFromSafety(hit), hit.report, { onProgress })
          const sourceFailed = report.sources.some(s => s.status === "error")
          const state = sourceFailed ? "failed" : published(report) ? "ready" : "unavailable"
          await writeJson(fileFor(key), { state, updatedAt: iso(), ...(state === "ready" ? {} : { retryAt: new Date(deps.now() + (sourceFailed ? ERROR_COOLDOWN_MS : DAY)).toISOString() }) } satisfies Job)
          console.info(`[nightlife] ${key}: ${report.outcome}; ${report.venues.length} venues${sourceFailed ? "; source refresh failed" : ""}`)
        } catch (error) {
          console.error(`[nightlife] ${key}: generation failed`, error instanceof Error ? error.message : "Unknown error")
          await writeJson(fileFor(key), { state: "failed", updatedAt: iso(), retryAt: new Date(deps.now() + ERROR_COOLDOWN_MS).toISOString() } satisfies Job)
        } finally {
          clearInterval(heartbeat)
          await release(globalLock, token)
        }
      }
      ownsLock = false // The after-response callback now owns release.
      return { status: { state: "running", available: status.available, phase: "resolve", retryAfter: 3 }, run }
    } finally { if (ownsLock) await release(globalLock, token) }
  }
  return { inspect, prepare }
}
export const visitJobs = createVisitJobs()
