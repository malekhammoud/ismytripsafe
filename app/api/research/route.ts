import { runSafetyAgent } from "@/lib/agent"
import { geocode, gatherSafety } from "@/lib/data"
import { cacheKey, readCache, writeCache } from "@/lib/cache"
import type { SafetyQuery, StreamEvent, SafetyEnrichment } from "@/lib/types"

export const maxDuration = 300

export async function POST(request: Request) {
  const input: SafetyQuery = await request.json()
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: StreamEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      }

      try {
        // 1. Resolve the place (prefer autocomplete coords, else geocode robustly)
        const geo = input.placeGeo ?? (await geocode(input.place))
        if (!geo) {
          send({
            type: "error",
            message: `Couldn't find "${input.place}". Try a more specific place name.`,
          })
          return
        }

        // 1b. Cache: if this place's report was built recently, replay it
        //     instantly — no databases, no paid Claude run.
        const key = cacheKey(geo)
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
            send({ type: "done", cached: true, cachedAt: hit.cachedAt })
            return
          }
        }

        send({ type: "geo", place: geo })

        // 2. Gather the multi-database safety report (fast) + hero photo
        const bundle = await gatherSafety(geo)
        if (bundle.images.hero || bundle.images.gallery.length) {
          send({ type: "image", images: bundle.images })
        }
        send({ type: "safety", bundle })

        // 3. AI safety enrichment — interpret the real signals, add local intel
        let enrichment: SafetyEnrichment | null = null
        let prose = ""
        for await (const event of runSafetyAgent(geo, bundle)) {
          if (event.type === "enrichment") enrichment = event.data
          if (event.type === "text") prose += event.content
          send(event)
          if (event.type === "done" || event.type === "error") break
        }

        // 4. Persist the finished report for next time (only if it fully built).
        if (enrichment) {
          await writeCache(key, {
            place: input.place,
            geo,
            images: bundle.images,
            bundle,
            enrichment,
            prose,
          })
        }
      } catch (err) {
        send({ type: "error", message: String(err) })
      } finally {
        controller.close()
      }
    },
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
