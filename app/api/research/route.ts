import { runSafetyAgent } from "@/lib/agent"
import { geocode, gatherSafety } from "@/lib/data"
import type { SafetyQuery, StreamEvent } from "@/lib/types"

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
          controller.close()
          return
        }
        send({ type: "geo", place: geo })

        // 2. Gather the multi-database safety report (fast) + hero photo
        const bundle = await gatherSafety(geo)
        if (bundle.images.hero || bundle.images.gallery.length) {
          send({ type: "image", images: bundle.images })
        }
        send({ type: "safety", bundle })

        // 3. AI safety enrichment — interpret the real signals, add local intel
        for await (const event of runSafetyAgent(geo, bundle)) {
          send(event)
          if (event.type === "done" || event.type === "error") break
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
