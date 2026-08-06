import Link from "next/link"
import { poolPhotoFor, sized, suppliedPhotoFor } from "@/lib/photos"
import { Photo } from "@/components/beach/Photo"
import { LEVELS } from "@/lib/safety-display"
import type { ReportMeta } from "@/lib/reports"

// ─────────────────────────────────────────────────────────────────────
// A destination as a postcard.
//
// A photograph inside a white deckle, the safety score ink-stamped in the
// top-left corner (the first place the eye lands), a rubber postmark
// top-right, and a "GREETINGS FROM —" caption strip.
//
// It used to turn over on hover to show the verdict. It doesn't any more:
// a wall of cards that all move when the mouse crosses them is restless,
// and hiding the one line that proves the product works behind a hover was
// exactly backwards. The card now does what a postcard does — sits still,
// says where it is, and straightens up when you reach for it.
// ─────────────────────────────────────────────────────────────────────

/** Score → stamp ink. Matches the safety spectrum in globals.css. */
export function stampInk(score: number): string {
  if (score >= 70) return "var(--safe)"
  if (score >= 55) return "var(--moderate)"
  if (score >= 40) return "var(--caution)"
  return "var(--risky)"
}

/** The perforated score stamp. Top-left on every card. */
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

  // Three sources, in order. A scene drawn for this exact city wins, because
  // it was chosen for this card rather than scraped for an encyclopaedia —
  // and because it is bound by hand it can never be somewhere else. Then the
  // destination's own photograph. Then a stand-in from the house pool, which
  // has to say where it really is.
  const supplied = suppliedPhotoFor(meta.path)
  const own = !supplied && !!meta.image
  const stand_in = poolPhotoFor(meta.path, index)
  const photo = supplied ? supplied.file : own ? sized(meta.image as string) : stand_in.file

  return (
    // The whole card is one link — a postcard is a single object.
    <Link
      href={meta.path}
      className="block rounded-[3px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]"
      aria-label={`Safety report for ${meta.city}, ${meta.country} — score ${meta.score} out of 100, ${level.label}`}
    >
      <div className="postcard">
        <ScoreStamp score={meta.score} />
        <Postmark code={meta.countryCode} iso={meta.updatedAt} />
        <div className="postcard-art aspect-[3/2]">
          <Photo
            src={photo}
            original={supplied ? null : meta.image}
            fallback={supplied ? supplied.file : stand_in.file}
            alt={supplied ? `${meta.city}, ${meta.country}` : own ? `${meta.city}, ${meta.country}` : stand_in.place ?? ""}
            width={960}
            height={640}
          />
          {/* When the photograph isn't of this place, say where it is.
              A card headed "Greetings from Monte Carlo" over an unlabelled
              beach in Rhodes is a small lie, and this site is supposed to
              be the one that doesn't tell them. */}
          {!own && !supplied && stand_in.place && (
            <span className="photo-elsewhere">{stand_in.place}</span>
          )}
          {/* And when the picture was drawn rather than taken, say that.
              It is the same principle: the reader should never have to
              wonder which of the two they are looking at. */}
          {supplied && <span className="photo-elsewhere">Illustration</span>}
        </div>
        <div className="flex items-end justify-between gap-3 px-1 pb-2.5 pt-2">
          <div className="min-w-0">
            <p className="postcard-greeting">Greetings from</p>
            <p className="font-display truncate text-[1.2rem] font-medium leading-tight tracking-tight text-[var(--navy)]">
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
    </Link>
  )
}
