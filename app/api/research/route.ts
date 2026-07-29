import { after } from "next/server"
import { runSafetyAgent, collectResearch, generateMapZones } from "@/lib/agent"
import { timeLog } from "@/lib/timing"
import { geocode, gatherSafety } from "@/lib/data"
import { getWikivoyageSafety } from "@/lib/data/wikivoyage"
import { cacheKey, readCache, readCacheAnyAge, readStale, writeCache } from "@/lib/cache"
import { pathForGeo } from "@/lib/reports"
import { pingIndexNow } from "@/lib/seo/indexnow"
import type { SafetyQuery, StreamEvent, SafetyEnrichment, GeoPoint } from "@/lib/types"

export const maxDuration = 300

/**
 * Cache keys with a background rebuild already running. Two people opening the
 * same stale city — or `scripts/pregenerate.mjs`, which now races through
 * stale entries instead of blocking on each — would otherwise each kick off a
 * full rebuild of the same report and burn the free-model quota several times
 * over for one result.
 */
const rebuilding = new Set<string>()

function rebuildOnce(geo: GeoPoint, key: string, place: string): () => Promise<void> {
  return async () => {
    if (rebuilding.has(key)) return
    rebuilding.add(key)
    try {
      await rebuild(geo, key, place)
    } finally {
      rebuilding.delete(key)
    }
  }
}

export async function POST(request: Request) {
  const input: SafetyQuery = await request.json()
  const encoder = new TextEncoder()

  // Work to run once the response has finished streaming: the deferred map-zone
  // pass and any stale-while-revalidate rebuild. Populated inside the stream and
  // drained by `after`, so none of it holds up the reader.
  const background: Array<() => Promise<void>> = []

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false
      const send = (event: StreamEvent) => {
        if (closed) return
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      }

      const t0 = Date.now()
      try {
        // 1. Resolve the place (prefer autocomplete coords, else geocode robustly)
        const geo = input.placeGeo ?? (await geocode(input.place))
        timeLog("geocode", Date.now() - t0, input.place)
        if (!geo) {
          send({
            type: "error",
            message: `Couldn't find "${input.place}". Try a more specific place name.`,
          })
          return
        }

        const key = cacheKey(geo)

        // 1a. Rescore: re-gather the databases and recompute, keeping the
        //     stored field research and briefing. After a scoring change the
        //     narrative is still true — only the numbers behind it moved — so
        //     there is no reason to pay a model to write it again.
        if (input.rescore) {
          const prior = await readCacheAnyAge(key)
          if (!prior) {
            send({ type: "error", message: `No stored report for ${input.place} to rescore.` })
            return
          }
          const [bundle, wikivoyage] = await Promise.all([
            gatherSafety(geo),
            getWikivoyageSafety(geo).catch(() => null),
          ])
          void wikivoyage

          // Refuse to overwrite a good report with a worse-informed one. A
          // rescore re-fetches ~20 upstream sources; when one of them flakes,
          // the affected pillar is imputed from a pessimistic prior and the
          // score swings hard. Seen in testing: a failed World Bank governance
          // fetch put Munich below Berlin on identical national data. Losing a
          // rescore is nothing — losing the stored report to a transient
          // network error is real.
          const priorImputed = (prior.bundle.safety.pillars ?? []).filter((p) => p.imputed).length
          const freshImputed = (bundle.safety.pillars ?? []).filter((p) => p.imputed).length
          if (freshImputed > priorImputed) {
            send({
              type: "error",
              message:
                `Rescore skipped for ${prior.place}: ${freshImputed} pillar(s) came back ` +
                `without data (was ${priorImputed}). Keeping the stored report.`,
            })
            return
          }

          send({ type: "geo", place: geo })
          send({ type: "safety", bundle })
          send({ type: "enrichment", data: prior.enrichment })
          if (prior.prose) send({ type: "text", content: prior.prose })
          await writeCache(key, {
            place: prior.place,
            geo,
            images: bundle.images.hero || bundle.images.gallery.length ? bundle.images : prior.images,
            bundle,
            enrichment: prior.enrichment,
            prose: prior.prose,
            // Keep the original publish date; the research did not change.
            cachedAt: prior.cachedAt,
          })
          send({ type: "done", cached: false, path: pathForGeo(geo) })
          return
        }

        // 1b. Cache: if this place's report was built recently, replay it
        //     instantly — no databases, no model run.
        if (!input.refresh) {
          const hit = await readCache(key)
          if (hit) {
            send({ type: "geo", place: hit.geo })
            if (hit.images.hero || hit.images.gallery.length) {
              send({ type: "image", images: hit.images })
            }
            send({ type: "safety", bundle: hit.bundle })
            send({ type: "enrichment", data: hit.enrichment })
            if (hit.prose) send({ type: "text", content: hit.prose })
            send({ type: "done", cached: true, cachedAt: hit.cachedAt, path: pathForGeo(hit.geo) })
            return
          }

          // 1c. Past its TTL but not ancient: serve the stored report NOW and
          //     rebuild in the background. Nobody should wait ~10s for a
          //     refresh of a report we already have a good copy of.
          const stale = await readStale(key)
          if (stale) {
            send({ type: "geo", place: stale.geo })
            if (stale.images.hero || stale.images.gallery.length) {
              send({ type: "image", images: stale.images })
            }
            send({ type: "safety", bundle: stale.bundle })
            send({ type: "enrichment", data: stale.enrichment })
            if (stale.prose) send({ type: "text", content: stale.prose })
            send({
              type: "done",
              cached: true,
              cachedAt: stale.cachedAt,
              path: pathForGeo(stale.geo),
            })
            background.push(rebuildOnce(geo, key, input.place))
            return
          }
        }

        send({ type: "geo", place: geo })

        // 2. Kick off the web research IMMEDIATELY. It needs only `geo` — it
        //    does not read the safety bundle — so running it alongside the
        //    database gather removes a whole serial wave from the critical path.
        const tResearch = Date.now()
        const researchPromise = collectResearch(geo, (q) =>
          send({ type: "searching", query: q })
        ).then((d) => {
          timeLog("research", Date.now() - tResearch, `${d.headlines.length}h ${d.extracts.length}x`)
          return d
        })

        // 3. Gather the multi-database safety report (fast) + hero photo,
        //    plus the Wikivoyage "Stay safe" section as agent background.
        const tBundle = Date.now()
        const [bundle, wikivoyage] = await Promise.all([
          gatherSafety(geo),
          getWikivoyageSafety(geo).catch(() => null),
        ])
        timeLog("bundle", Date.now() - tBundle)
        if (bundle.images.hero || bundle.images.gallery.length) {
          send({ type: "image", images: bundle.images })
        }
        send({ type: "safety", bundle })
        timeLog("visible", Date.now() - t0, "← report renders here")

        // By now the research is usually already in.
        const dossier = await researchPromise
        timeLog("research.awaited", Date.now() - t0)

        // 4. AI safety enrichment — interpret the real signals, add local intel
        let enrichment: SafetyEnrichment | null = null
        let prose = ""
        const allowFallback = !input.noFallback
        for await (const event of runSafetyAgent(geo, bundle, wikivoyage, dossier, allowFallback)) {
          if (event.type === "enrichment") enrichment = event.data
          if (event.type === "text") prose += event.content
          if (event.type === "done") {
            send({ ...event, path: pathForGeo(geo) })
          } else {
            send(event)
          }
          if (event.type === "done" || event.type === "error") break
        }

        // 5. Persist the finished report for next time (only if it fully built).
        //    The permanent page is live the moment the file lands — tell the
        //    search engines about it (IndexNow → Bing → ChatGPT's index).
        if (enrichment) {
          const settled = enrichment
          await writeCache(key, {
            place: input.place,
            geo,
            images: bundle.images,
            bundle,
            enrichment: settled,
            prose,
          })
          pingIndexNow([pathForGeo(geo)])

          // 6. District ratings render only on the map page, so they are
          //    generated after the reader already has their report and merged
          //    into the cached record when they land.
          background.push(async () => {
            const zones = await generateMapZones(geo, bundle, wikivoyage, dossier, allowFallback)
            if (!zones) return
            await writeCache(key, {
              place: input.place,
              geo,
              images: bundle.images,
              bundle,
              enrichment: { ...settled, ...zones },
              prose,
            })
          })
        }
      } catch (err) {
        send({ type: "error", message: String(err) })
      } finally {
        closed = true
        controller.close()
      }
    },
  })

  // Runs once the stream is done — the reader is already served by this point.
  after(async () => {
    for (const task of background) {
      await task().catch(() => {})
    }
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}

/**
 * Full cold rebuild of a stale report, run in the background.
 *
 * No paid fallback here: the reader was already served the stored copy
 * instantly, so nobody is waiting on this. If the free models are spent, the
 * refresh can happen tomorrow rather than cost money tonight.
 */
async function rebuild(geo: GeoPoint, key: string, place: string): Promise<void> {
  const researchPromise = collectResearch(geo)
  const [bundle, wikivoyage] = await Promise.all([
    gatherSafety(geo),
    getWikivoyageSafety(geo).catch(() => null),
  ])
  const dossier = await researchPromise

  let enrichment: SafetyEnrichment | null = null
  let prose = ""
  for await (const event of runSafetyAgent(geo, bundle, wikivoyage, dossier, false)) {
    if (event.type === "enrichment") enrichment = event.data
    if (event.type === "text") prose += event.content
    if (event.type === "done" || event.type === "error") break
  }
  if (!enrichment) return

  const zones = await generateMapZones(geo, bundle, wikivoyage, dossier, false)
  await writeCache(key, {
    place,
    geo,
    images: bundle.images,
    bundle,
    enrichment: zones ? { ...enrichment, ...zones } : enrichment,
    prose,
  })
}
