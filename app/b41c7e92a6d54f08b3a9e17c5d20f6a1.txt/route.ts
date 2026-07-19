import { INDEXNOW_KEY } from "@/lib/seo/indexnow"

/** IndexNow key verification file. */
export function GET() {
  return new Response(INDEXNOW_KEY, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}
