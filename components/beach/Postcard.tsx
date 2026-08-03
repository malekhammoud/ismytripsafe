import Link from "next/link"
import { poolPhotoFor, sized } from "@/lib/photos"
import { Photo } from "@/components/beach/Photo"
import { LEVELS } from "@/lib/safety-display"
import type { ReportMeta } from "@/lib/reports"

// ─────────────────────────────────────────────────────────────────────
// A destination as a postcard.
//
// Front: a photograph inside a white deckle, the safety score
// ink-stamped in the top-left corner (the first place the eye lands), a
// rubber postmark top-right, and a "GREETINGS FROM —" caption strip.
//
// Reverse (on hover / keyboard focus): the written side — the report's
// one-line verdict as the message, and a ruled address block. Same score
// stamp top-left, so the number never disappears mid-flip.
// ─────────────────────────────────────────────────────────────────────

/** Score → stamp ink. Matches the safety spectrum in globals.css. */
export function stampInk(score: number): string {
  if (score >= 70) return "var(--safe)"
  if (score >= 55) return "var(--moderate)"
  if (score >= 40) return "var(--caution)"
  return "var(--risky)"
}

/** The perforated score stamp. Top-left on both faces of every card. */
export function ScoreStamp({ score, size = 1 }: { score: number; size?: number }) {
  return (
    <span
      className="score-stamp"
      style={
        {
          "--stamp": stampInk(score),
          width: 54 * size,
          top: 18 * size,
          left: 18 * size,
        } as React.CSSProperties
      }
      aria-label={`Safety score ${score} out of 100`}
    >
      <span className="n" style={{ fontSize: `${1.42 * size}rem` }}>
        {score}
      </span>
      <span className="cap" style={{ fontSize: `${0.42 * size}rem` }}>
        Safety
      </span>
    </span>
  )
}

/** Circular rubber date stamp — country code over the month it was checked. */
export function Postmark({ code, iso }: { code: string; iso: string }) {
  const d = new Date(iso)
  const valid = Number.isFinite(d.getTime()) ? d : new Date()
  const month = valid.toLocaleDateString("en-GB", { month: "short" }).toUpperCase()
  return (
    <span className="postmark" aria-hidden>
      <span className="top">{code || "WORLD"}</span>
      <span className="mid">
        {month} {String(valid.getFullYear()).slice(2)}
      </span>
      <span className="bot">Checked</span>
    </span>
  )
}

export function Postcard({
  meta,
  index = 0,
}: {
  meta: ReportMeta
  /**
   * Position in its deck. Only used to spread the fallback pool: cards
   * without a photo of their own would otherwise be free to collide, and two
   * identical beaches side by side look like a bug.
   */
  index?: number
}) {
  const level = LEVELS[meta.level]
  // A photograph of the actual place if the report found one; otherwise a
  // coastal photo from the house pool, picked from the destination's own path
  // so it stays put between renders.
  const own = !!meta.image
  const stand_in = poolPhotoFor(meta.path, index)
  const photo = own ? sized(meta.image as string) : stand_in.file
  const message =
    meta.verdict?.trim() ||
    `${level.answer}. Scored ${meta.score}/100 against crime, governance, health, hazards and the current official advisory.`

  return (
    // The whole card is one link — a postcard is a single object, and the
    // flip is presentation, not two separate destinations.
    <Link
      href={meta.path}
      className="postcard-flip block rounded-[3px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]"
      aria-label={`Safety report for ${meta.city}, ${meta.country} — score ${meta.score} out of 100, ${level.label}`}
    >
      <div className="postcard">
        {/* ── Front ── */}
        <div className="postcard-face">
          <ScoreStamp score={meta.score} />
          <Postmark code={meta.countryCode} iso={meta.updatedAt} />
          <div className="postcard-art aspect-[3/2]">
            <Photo
              src={photo}
              original={meta.image}
              fallback={stand_in.file}
              alt={own ? `${meta.city}, ${meta.country}` : stand_in.place ?? ""}
              width={960}
              height={640}
            />
            {/* When the photograph isn't of this place, say where it is.
                A card headed "Greetings from Monte Carlo" over an unlabelled
                beach in Rhodes is a small lie, and this site is supposed to
                be the one that doesn't tell them. */}
            {!own && stand_in.place && (
              <span className="photo-elsewhere">{stand_in.place}</span>
            )}
          </div>
          <div className="flex items-end justify-between gap-3 px-1 pb-2.5 pt-2">
            <div className="min-w-0">
              <p className="postcard-greeting">Greetings from</p>
              <p className="font-display truncate text-[1.15rem] font-medium leading-tight tracking-tight text-[var(--navy)]">
                {meta.city}
              </p>
              <p className="truncate text-[0.7rem] text-[var(--ink-faint)]">
                {meta.flag && <span className="mr-1">{meta.flag}</span>}
                {meta.country}
              </p>
            </div>
            <p
              className="shrink-0 pb-0.5 text-[0.66rem] font-bold uppercase tracking-[0.11em]"
              style={{ color: stampInk(meta.score) }}
            >
              {level.label}
            </p>
          </div>
        </div>

        {/* ── Reverse ── */}
        <div className="postcard-face postcard-face--back">
          <ScoreStamp score={meta.score} />
          <Postmark code={meta.countryCode} iso={meta.updatedAt} />
          <span className="divider" aria-hidden />

          <p className="postcard-greeting mt-[2.6rem]">The verdict</p>

          <div className="mt-2 flex min-h-0 flex-1 gap-3">
            {/* message side */}
            <p className="font-display w-[49%] shrink-0 overflow-hidden pr-2 text-[0.78rem] italic leading-[1.55] text-[var(--ink-soft)]">
              {message}
            </p>
            {/* address side */}
            <div className="flex min-w-0 flex-1 flex-col justify-end">
              <span className="address-lines mb-2 block h-[54px] w-full" aria-hidden />
              <p className="truncate text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-[var(--ink-faint)]">
                {meta.city}, {meta.country}
              </p>
            </div>
          </div>

          <span className="mt-2.5 inline-flex shrink-0 items-center gap-1 self-start border-b border-[var(--orange)] pb-0.5 text-[0.72rem] font-bold text-[var(--orange-deep)]">
            Read the full report →
          </span>
        </div>
      </div>
    </Link>
  )
}
