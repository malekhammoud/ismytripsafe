import { promises as fs } from "node:fs"
import path from "node:path"
import { randomUUID } from "node:crypto"
import type { CachedReport } from "../cache"
import type { ReportMeta } from "../reports"
import { buildNightlife } from "./build"
import { FORMULA_VERSION } from "./scoring"
import { PIPELINE_VERSION } from "./version"
import { withResearchDeadline } from "./http"
import { usesPublicOverpass } from "./overpass"
import { NIGHTLIFE_DIR, readNightlife, safeKey, writeJson } from "./store"
import type { City, NightlifeReport } from "./types"
import type { BuildPhase, VisitStatus } from "./visit-types"
export type CitySafety = { report: CachedReport; meta: ReportMeta }
const DAY = 86400000
const LEASE_MS = 15 * 60 * 1000
const ERROR_COOLDOWN_MS = 10 * 60 * 1000
interface Job extends Pick<VisitStatus, "issue" | "failedSources" | "sourceFailures" | "venueCount" | "scoreCount"> { state: "running" | "ready" | "unavailable" | "failed"; updatedAt: string; retryAt?: string; phase?: BuildPhase; token?: string; version?: string }
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
  return r.sources.some(s => s.status === "error") || r.pipelineVersion !== PIPELINE_VERSION || r.formulaVersion !== FORMULA_VERSION || older(r.refresh.venues || r.updatedAt, 30) || older(r.refresh.population || r.updatedAt, 180) || older(r.updatedAt, 30)
    || (!!process.env.TICKETMASTER_API_KEY && older(r.refresh.events, 7))
    || (!!process.env.NUMBEO_API_KEY && process.env.NUMBEO_STORAGE_LICENSED === "1" && older(r.refresh.beer, 180))
}
async function readJson<T>(file: string): Promise<T | null> {
  try { return JSON.parse(await fs.readFile(file, "utf8")) as T }
  catch (e) { if (e instanceof SyntaxError || (e as NodeJS.ErrnoException).code === "ENOENT") return null; throw e }
}
export function createVisitJobs(overrides: Partial<Dependencies> = {}) {
  const publicProvider = usesPublicOverpass()
  const configuredLimit = Number(process.env.NIGHTLIFE_ON_DEMAND_DAILY_LIMIT) || (publicProvider ? 10 : 100)
  const deps: Dependencies = { directory: NIGHTLIFE_DIR, now: Date.now, read: readNightlife, build: buildNightlife, limit: Math.max(1, Math.min(publicProvider ? 10 : 1000, configuredLimit)), ...overrides }
  const jobs = path.join(deps.directory, "jobs")
  const fileFor = (key: string) => path.join(jobs, `${safeKey(key)}.json`)
  const iso = () => new Date(deps.now()).toISOString()
  const globalLock = path.join(jobs, "research.lock")
  const sourceCooldown = path.join(jobs, "source-cooldown.json")
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
    if (job?.state === "running" && deps.now() - Date.parse(job.updatedAt) < LEASE_MS) {
      const lock = await readJson<{ token: string }>(globalLock)
      if (lock && (!job.token || lock.token === job.token)) return { state: "running", available, phase: job.phase, retryAfter: 3 }
    }
    const detail = job ? { issue: job.issue, failedSources: job.failedSources, sourceFailures: job.sourceFailures, venueCount: job.venueCount, scoreCount: job.scoreCount } : {}
    if (job?.version === PIPELINE_VERSION && job.retryAt && Date.parse(job.retryAt) > deps.now()) return { ...detail, state: available ? "ready" : job.state === "unavailable" ? "unavailable" : "failed", available, retryAt: job.retryAt, retryAfter: Math.ceil((Date.parse(job.retryAt) - deps.now()) / 1000) }
    if (available && report && !needsNightlifeRefresh(report, deps.now())) return { state: "ready", available: true, updatedAt: report.updatedAt }
    // A genuine thin-data result is retried daily; outages use the shorter job cooldown.
    if (report?.outcome === "withheld" && report.pipelineVersion === PIPELINE_VERSION && !report.sources.some(s => s.status === "error") && deps.now() - Date.parse(report.updatedAt) < DAY) return { ...detail, state: "unavailable", available: false, venueCount: report.venues.length, scoreCount: report.scores.filter(s => s.value != null).length, retryAt: new Date(Date.parse(report.updatedAt) + DAY).toISOString(), retryAfter: Math.max(1, Math.ceil((DAY - (deps.now() - Date.parse(report.updatedAt))) / 1000)) }
    // A provider's request to wait applies across cities. Opening a second
    // destination must not consume another attempt against the same cooldown.
    const cooldown = await readJson<VisitStatus>(sourceCooldown)
    if (cooldown?.retryAt && Date.parse(cooldown.retryAt) > deps.now()) return { ...cooldown, state: available ? "ready" : "failed", available, retryAfter: Math.ceil((Date.parse(cooldown.retryAt) - deps.now()) / 1000) }
    return { state: "idle", available }
  }
  async function prepare(hit: CitySafety): Promise<{ status: VisitStatus; run?: () => Promise<void> }> {
    const key = safeKey(hit.meta.key), status = await inspect(key)
    if (status.state !== "idle") return { status }
    const token = randomUUID()
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
        return { status: { state: "deferred", available: status.available, retryAt: new Date(tomorrow).toISOString(), retryAfter: Math.ceil((tomorrow - deps.now()) / 1000) } }
      }
      await writeJson(budgetFile, { attempts: budget.attempts + 1 })
      const writeJob = (job: Job) => writeJson(fileFor(key), { ...job, token, version: PIPELINE_VERSION })
      await writeJob({ state: "running", phase: "resolve", updatedAt: iso() })
      let started = false
      const run = async () => {
        if (started) return
        started = true
        if ((await readJson<{ token: string }>(globalLock))?.token !== token) return
        const heartbeat = setInterval(() => { void (async () => {
          if ((await readJson<{ token: string }>(globalLock))?.token !== token) return
          const now = new Date(deps.now())
          await fs.utimes(globalLock, now, now)
        })().catch(() => {}) }, 30000)
        heartbeat.unref()
        try {
          const onProgress = async (phase: BuildPhase) => { await writeJob({ state: "running", phase, updatedAt: iso() }) }
          const report = await withResearchDeadline(() => deps.build(cityFromSafety(hit), hit.report, { onProgress, interactive: true }))
          const sourceFailed = report.sources.some(s => s.status === "error")
          const sourceFailures = report.sources.filter(s => s.status === "error" && s.failure).map(s => ({ name: s.name, ...s.failure! }))
          const requiredCooldowns = report.sources.filter(s => ["wikidata", "osm"].includes(s.id) && s.status === "error" && Date.parse(s.failure?.retryAt ?? "") > deps.now()).map(s => ({ name: s.name, ...s.failure! }))
          if (requiredCooldowns.length) await writeJson(sourceCooldown, { state: "failed", available: false, issue: "sources", failedSources: requiredCooldowns.map(s => s.name), sourceFailures: requiredCooldowns, retryAt: new Date(Math.max(...requiredCooldowns.map(s => Date.parse(s.retryAt!)))).toISOString() })
          const retryAt = Math.max(deps.now() + ERROR_COOLDOWN_MS, ...sourceFailures.map(f => Date.parse(f.retryAt ?? "")).filter(Number.isFinite))
          const state = published(report) ? "ready" : sourceFailed ? "failed" : "unavailable"
          const issue = sourceFailed ? "sources" : !report.city.wikidataId ? "city" : !report.city.boundaryVerified ? "boundary" : "evidence"
          await writeJob({ state, updatedAt: iso(), venueCount: report.venues.length, scoreCount: report.scores.filter(s => s.value != null).length,
            ...(state !== "ready" || sourceFailed ? { issue, sourceFailures, failedSources: report.sources.filter(s => s.status === "error").map(s => s.name), retryAt: new Date(sourceFailed ? retryAt : deps.now() + DAY).toISOString() } : {}) })
          console.info(`[nightlife] ${key}: ${report.outcome}; ${report.venues.length} venues${sourceFailed ? "; source refresh failed" : ""}`)
        } catch (error) {
          console.error(`[nightlife] ${key}: generation failed`, error instanceof Error ? error.message : "Unknown error")
          await writeJob({ state: "failed", issue: "service", updatedAt: iso(), retryAt: new Date(deps.now() + ERROR_COOLDOWN_MS).toISOString() })
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
