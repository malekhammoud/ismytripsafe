import Link from "next/link"
import type { ReportMeta } from "@/lib/reports"
import { LEVELS } from "@/lib/safety-display"
import { suppliedPhotoFor, sized } from "@/lib/photos"
import { SectionHeading } from "./shared"

/**
 * "Keep exploring" — related reports as photo cards, not text lines.
 *
 * Every photograph shows the place it names. The picture is, in order:
 *   1. the destination's own report lead image — an editorially-chosen
 *      photograph of the actual city (Wikipedia → Wikivoyage → Wikimedia
 *      Commons, three independent source families);
 *   2. its commissioned illustration, when one exists;
 *   3. otherwise no photograph at all — a warm gradient with the flag —
 *      because a stock beach under a city it isn't is a lie the scoreboard
 *      would call out, and so should we.
 */

function CardPhoto({ meta, city, country }: { meta: ReportMeta; city: string; country: string }) {
  const supplied = suppliedPhotoFor(meta.path)
  const src = meta.image ? sized(meta.image, 960) : (supplied?.file ?? null)
  if (src) {
    return (
      <div className="relative h-28 overflow-hidden bg-[var(--paper-deep)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={`${city}, ${country}`}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
        />
      </div>
    )
  }
  // Honest stand-in: the city's own flag on the palette's sand, no photo made up.
  return (
    <div
      className="flex h-28 items-center justify-center"
      style={{ background: "linear-gradient(150deg, #eef7f6, #f7e8c8)" }}
    >
      <span className="text-5xl" aria-hidden>
        {meta.flag}
      </span>
    </div>
  )
}

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
          const level = LEVELS[m.level]
          return (
            <Link
              key={m.path}
              href={m.path}
              className="card group overflow-hidden !p-0 transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[var(--shadow-float)]"
            >
              <CardPhoto meta={m} city={m.city} country={m.country} />
              <div className="relative px-3.5 py-2.5">
                <span
                  className="absolute right-2.5 top-0 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-[0.85rem] font-bold text-white shadow-[0_4px_14px_rgba(0,0,0,0.3)]"
                  style={{ background: level.color }}
                  aria-label={`Safety score ${m.score} out of 100`}
                >
                  {m.score}
                </span>
                <p className="truncate pr-8 text-[0.92rem] font-semibold text-[var(--ink)]">
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