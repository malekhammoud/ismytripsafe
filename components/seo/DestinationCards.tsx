import Link from "next/link"
import type { ReportMeta } from "@/lib/reports"
import { LEVELS } from "@/lib/safety-display"
import { poolPhotoFor, suppliedPhotoFor } from "@/lib/photos"
import { SectionHeading } from "./shared"

/**
 * "Keep exploring" — related reports as photo cards, not text lines.
 *
 * A report ends with three rows of links (same country, nearby, similar
 * score); links are homework, cards look like doors. Each card shows the
 * destination's own commissioned illustration when one exists, otherwise a
 * stable, freely-licensed house-pool photograph (the same stand-in rule the
 * destination cards on the rest of the site use), with the score as a stamp.
 */

export function RelatedGrid({
  title,
  items,
  limit = 6,
}: {
  title: string
  items: ReportMeta[]
  limit?: number
}) {
  if (!items.length) return null
  const cards = items.slice(0, limit)
  return (
    <section className="mt-9">
      <SectionHeading note={`${cards.length} report${cards.length === 1 ? "" : "s"}`}>{title}</SectionHeading>
      <div className="mt-3.5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((m) => {
          const photo = suppliedPhotoFor(m.path) ?? poolPhotoFor(m.path, 0)
          const level = LEVELS[m.level]
          return (
            <Link
              key={m.path}
              href={m.path}
              className="card group overflow-hidden !p-0 transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[var(--shadow-float)]"
            >
              <div className="relative h-28 overflow-hidden bg-[var(--paper-deep)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.file}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                />
                <span
                  className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full text-[0.85rem] font-bold text-white shadow-[0_4px_14px_rgba(0,0,0,0.3)]"
                  style={{ background: level.color }}
                  aria-label={`Safety score ${m.score} out of 100`}
                >
                  {m.score}
                </span>
              </div>
              <div className="px-3.5 py-2.5">
                <p className="truncate text-[0.92rem] font-semibold text-[var(--ink)]">
                  {m.flag && <span className="mr-1.5">{m.flag}</span>}
                  {m.city}
                </p>
                <p className="truncate text-[0.72rem] text-[var(--ink-faint)]">
                  {level.label} · {m.country}
                </p>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}