import { aiResolvePlace } from "@/lib/ai-resolve"

export const dynamic = "force-dynamic"

/**
 * AI long-tail resolver: query → one grounded destination. Only ever reached
 * when the local engine and the geocoder both drew a blank; bounded (cached
 * + rate-capped) so a typing session can't spend the model budget.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { q?: string }
    | null
  const q = (body?.q ?? "").trim().slice(0, 80)
  if (q.length < 4) {
    return Response.json({ hit: null })
  }

  const hit = await aiResolvePlace(q)
  return Response.json(
    { hit },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  )
}