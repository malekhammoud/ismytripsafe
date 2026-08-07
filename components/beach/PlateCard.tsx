import Link from "next/link"
import { suppliedPhotoFor } from "@/lib/photos"
import type { ReportMeta } from "@/lib/reports"

/** Score → ink. Matches the safety spectrum in globals.css. */
export function stampInk(score: number): string {
  if (score >= 70) return "var(--safe)"
  if (score >= 55) return "var(--moderate)"
  if (score >= 40) return "var(--caution)"
  return "var(--risky)"
}

// ─────────────────────────────────────────────────────────────────────
// A postcard, used as it was drawn.
//
// These pictures arrive with a torn cream border painted into the pixels.
// That border is the whole charm of them, and it is also already a frame —
// so nothing at all goes on top: no stamp, no rubber postmark, no caption
// bar, no chip in the corner. The picture is the picture.
//
// Everything the card has to say is said underneath it instead, the way a
// caption sits under a photograph in an album: the place in the display
// serif, the score in mono beside it, the country small and quiet below.
// Two lines, three facts, and no furniture.
// ─────────────────────────────────────────────────────────────────────

export function PlateCard({ meta, priority = false }: { meta: ReportMeta; priority?: boolean }) {
  const photo = suppliedPhotoFor(meta.path)
  if (!photo) return null

  return (
    <Link
      href={meta.path}
      className="pc"
      aria-label={`${meta.city}, ${meta.country} — safety score ${meta.score} out of 100`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.file}
        alt={`${meta.city}, ${meta.country}`}
        className="pc-shot"
        width={1440}
        height={960}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
      />
      <span className="pc-cap">
        <span className="pc-city">{meta.city}</span>
        <span className="pc-lead" aria-hidden />
        <span className="pc-score" style={{ "--pc-ink": stampInk(meta.score) } as React.CSSProperties}>
          {meta.score}
        </span>
        <span className="pc-country">{meta.country}</span>
      </span>
    </Link>
  )
}
