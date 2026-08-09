import Link from "next/link"
import { suppliedPhotoFor, poolPhotoFor } from "@/lib/photos"
import type { ReportMeta } from "@/lib/reports"

/** Score → ink. Matches the safety spectrum in globals.css. */
export function stampInk(score: number): string {
  if (score >= 70) return "var(--safe)"
  if (score >= 55) return "var(--moderate)"
  if (score >= 40) return "var(--caution)"
  return "var(--risky)"
}

export function PlateCard({ meta, priority = false }: { meta: ReportMeta; priority?: boolean }) {
  const supplied = suppliedPhotoFor(meta.path)
  const photoFile = supplied?.file || meta.image || poolPhotoFor(meta.path).file

  return (
    <Link
      href={meta.path}
      className="pc"
      aria-label={`${meta.city}, ${meta.country} — safety score ${meta.score} out of 100`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photoFile}
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
