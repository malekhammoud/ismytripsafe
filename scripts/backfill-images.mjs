#!/usr/bin/env node
// One-time backfill: find reports whose lead image is missing and give them
// one by re-running the same editorially-curated image chain the report build
// uses — Wikipedia REST summary → Wikivoyage pageimage → Wikimedia Commons
// search (see lib/data/images.ts; the chain is: Wikipedia lead first, then
// Wikivoyage, then Commons). Only the cache file is touched: data, prose and
// dates are preserved (cachedAt stays put, so "last updated" never lies about
// data that did not change).
//
//   node scripts/backfill-images.mjs            # all image-less reports
//   node scripts/backfill-images.mjs --dry-run  # just count them
//   node scripts/backfill-images.mjs --limit 5  # try N, then stop
import { readdir, readFile, writeFile, rename } from "node:fs/promises"
import path from "node:path"

const CACHE_DIR = process.env.REPORT_CACHE_DIR || "/var/lib/ismytripsafe/reports"
const DRY = process.argv.includes("--dry-run")
const LIMIT_IDX = process.argv.indexOf("--limit")
const LIMIT = LIMIT_IDX >= 0 ? Number(process.argv[LIMIT_IDX + 1]) : Infinity
const CONCURRENCY = 3

const UA =
  "IsMyTripSafeBackfill/1.0 (one-time report-image backfill; contact hello@ismytripsafe.com)"
const NOT_A_PHOTO = /flag_of|coat_of_arms|locator|_map\b|\.svg/i
const usable = (u) => !!u && !NOT_A_PHOTO.test(u)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function json(url) {
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(15000),
    })
    if (r.ok) return r.json()
    if (r.status === 429) {
      // Wikimedia throttles bursts; a descriptive UA helps, the wait does the rest.
      const wait = Number(r.headers.get("retry-after")) || 30
      if (attempt >= 3) return null
      await sleep(wait * 1000)
      continue
    }
    return null
  }
}

/** Wikipedia REST summary — editorially-chosen lead image. */
async function wikiHero(title) {
  try {
    const d = await json(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
    )
    if (d.type === "disambiguation") return null
    const img = d.originalimage?.source ?? d.thumbnail?.source ?? null
    return usable(img) ? img : null
  } catch {
    return null
  }
}

/** Wikivoyage page image — travel-focused, great for destinations. */
async function voyageHero(title) {
  try {
    const d = await json(
      `https://en.wikivoyage.org/w/api.php?action=query&format=json&redirects=1` +
        `&prop=pageimages&piprop=original&titles=${encodeURIComponent(title)}`
    )
    for (const page of Object.values(d.query?.pages ?? {})) {
      const src = page.original?.source
      if (usable(src)) return src
    }
    return null
  } catch {
    return null
  }
}

/** Wikimedia Commons search — the wide net when nothing curated exists. */
async function commonsHero(query) {
  try {
    const d = await json(
      `https://commons.wikimedia.org/w/api.php?action=query&format=json` +
        `&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=6&gsrlimit=8` +
        `&prop=imageinfo&iiprop=url|mime&iiurlwidth=1600`
    )
    const pages = Object.values(d.query?.pages ?? {})
    for (const p of pages) {
      const info = p.imageinfo?.[0]
      if (!info?.thumburl) continue
      if (info.mime && !/^image\/(jpe?g|png|webp)$/.test(info.mime)) continue
      if (usable(info.thumburl)) return info.thumburl
    }
    return null
  } catch {
    return null
  }
}

async function heroFor(city, country) {
  const titles = [city, `${city}, ${country}`]
  for (const t of titles) {
    const h = await wikiHero(t)
    if (h) return h
  }
  const voyage = await voyageHero(city)
  if (voyage) return voyage
  return commonsHero(`${city} ${country} skyline cityscape`)
}

async function main() {
  const files = (await readdir(CACHE_DIR)).filter((f) => f.endsWith(".json") && !f.includes(".tmp"))
  const missing = []
  for (const f of files) {
    try {
      const raw = JSON.parse(await readFile(path.join(CACHE_DIR, f), "utf8"))
      const geo = raw.bundle?.geo
      if (!raw.images?.hero && geo?.city) missing.push({ f, geo })
    } catch {
      /* unreadable/corrupt — skip */
    }
  }
  console.log(`image-less reports: ${missing.length}`)
  if (DRY) return

  const queue = [...missing].slice(0, LIMIT)
  let done = 0
  let fixed = 0
  const worker = async () => {
    while (queue.length) {
      const { f, geo } = queue.shift()
      try {
        const hero = await heroFor(geo.city, geo.country)
        if (hero) {
          const file = path.join(CACHE_DIR, f)
          const report = JSON.parse(await readFile(file, "utf8"))
          report.images = {
            ...(report.images ?? {}),
            hero,
            blurb: report.images?.blurb ?? `A look at ${geo.city}, ${geo.country}.`,
          }
          // Atomic write; cachedAt preserved — this run changes pictures, not data.
          const tmp = path.join(CACHE_DIR, `${path.basename(f, ".json")}.${process.pid}.tmp`)
          await writeFile(tmp, JSON.stringify(report), "utf8")
          await rename(tmp, file)
          fixed++
        } else {
          console.log(`  still nothing for ${geo.city}, ${geo.country} (${f})`)
        }
      } catch (e) {
        console.log(`  error for ${geo.city}: ${e.message}`)
      } finally {
        done++
        if (done % 25 === 0) console.log(`  …${done}/${missing.length}`)
        await sleep(300 + Math.random() * 700)
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  console.log(`done: scanned ${done}, new hero images: ${fixed}`)
}

main().catch((e) => {
  console.error("FATAL", e)
  process.exit(1)
})