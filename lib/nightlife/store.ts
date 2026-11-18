import { promises as fs } from "node:fs"
import path from "node:path"
import { randomUUID } from "node:crypto"
import type { NightlifeReport } from "./types"
// Separate from production's safety cache. Never use REPORT_CACHE_DIR here.
export const NIGHTLIFE_DIR = process.env.NIGHTLIFE_CACHE_DIR || "/var/lib/ismytripsafe/nightlife"
export type NightlifeSummary = Pick<NightlifeReport, "city" | "updatedAt" | "outcome" | "overall" | "reasons" | "refresh"> & { venueCount: number; scoreCount: number; density: number | null }
export function safeKey(key: string) { if (!/^[a-z0-9][a-z0-9_-]{0,150}$/.test(key)) throw new Error("Invalid city key"); return key }
export async function readNightlife(key: string): Promise<NightlifeReport | null> {
  try { const r = JSON.parse(await fs.readFile(path.join(NIGHTLIFE_DIR, "reports", `${safeKey(key)}.json`), "utf8")) as NightlifeReport; return r.version === 1 ? r : null }
  catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT" || e instanceof SyntaxError) return null; throw e }
}
export async function writeJson(file: string, value: unknown) {
  await fs.mkdir(path.dirname(file), { recursive: true })
  const tmp = `${file}.${randomUUID()}.tmp`
  try {
    await fs.writeFile(tmp, JSON.stringify(value, null, 2), { mode: 0o600, flag: "wx" })
    await fs.rename(tmp, file)
  } finally { await fs.unlink(tmp).catch(e => { if (e.code !== "ENOENT") throw e }) }
}
export function summarize(r: NightlifeReport): NightlifeSummary {
  const density = r.scores.find(s => s.key === "density")?.inputs.density
  return { city: r.city, updatedAt: r.updatedAt, outcome: r.outcome, overall: r.overall, reasons: r.reasons, refresh: r.refresh, venueCount: r.venues.length, scoreCount: r.scores.filter(s => s.value != null).length, density: typeof density === "number" ? density : null }
}
const safeSlug = (s: string) => /^[a-z0-9][a-z0-9-]{0,100}$/.test(s)
let listCache: { at: number; reports: NightlifeSummary[] } | null = null
export async function saveNightlife(r: NightlifeReport) {
  if (!safeSlug(r.city.countrySlug) || !safeSlug(r.city.citySlug)) throw new Error("Invalid city slugs")
  const key = safeKey(r.city.key)
  await writeJson(path.join(NIGHTLIFE_DIR, "reports", `${key}.json`), r)
  await writeJson(path.join(NIGHTLIFE_DIR, "index", `${key}.json`), summarize(r))
  await writeJson(path.join(NIGHTLIFE_DIR, "lookup", r.city.countrySlug, `${r.city.citySlug}.json`), { key })
  listCache = null
}
// Directory cards, related cities and sitemap only read lightweight summaries,
// never every city's full venue list. Exact city lookups are one small read.
// A short process cache keeps the directory fast once there are hundreds of
// reports; the batch process invalidates its own cache when it saves.
export async function listNightlife(includeWithheld = false): Promise<NightlifeSummary[]> {
  if (!listCache || Date.now() - listCache.at > 5000) {
    let files: string[]
    try { files = await fs.readdir(path.join(NIGHTLIFE_DIR, "index")) } catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return []; throw e }
    const reports = await Promise.all(files.filter(f => /^[a-z0-9][a-z0-9_-]*\.json$/.test(f)).map(async f => {
      try { return JSON.parse(await fs.readFile(path.join(NIGHTLIFE_DIR, "index", f), "utf8")) as NightlifeSummary }
      catch (e) { if (e instanceof SyntaxError || (e as NodeJS.ErrnoException).code === "ENOENT") return null; throw e }
    }))
    listCache = { at: Date.now(), reports: reports.filter((r): r is NightlifeSummary => !!r) }
  }
  return includeWithheld ? listCache.reports : listCache.reports.filter(r => r.outcome !== "withheld")
}
export async function findNightlife(country: string, city: string) {
  if (!safeSlug(country) || !safeSlug(city)) return null
  let key: string
  try { key = JSON.parse(await fs.readFile(path.join(NIGHTLIFE_DIR, "lookup", country, `${city}.json`), "utf8")).key } catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT" || e instanceof SyntaxError) return null; throw e }
  const report = await readNightlife(key)
  return report && report.outcome !== "withheld" ? report : null
}
export const nightlifePath = (r: Pick<NightlifeReport, "city">) => `${r.city.safetyPath}/nightlife`

// Beta launch is deliberately uncrawlable until a production rollout.
export const NIGHTLIFE_INDEXABLE = process.env.NIGHTLIFE_INDEXABLE === "1"
export const nightlifeUrl = (pathname: string) => new URL(pathname, process.env.NIGHTLIFE_SITE_URL || "https://beta.ismytripsafe.com").href
