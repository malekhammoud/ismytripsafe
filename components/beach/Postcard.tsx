import Link from "next/link"
import { poolPhotoFor, sized, suppliedPhotoFor } from "@/lib/photos"
import { Photo } from "@/components/beach/Photo"
import { LEVELS } from "@/lib/safety-display"
import type { ReportMeta } from "@/lib/reports"

// ─────────────────────────────────────────────────────────────────────
// A destination as a postcard.
//
// This is the build for a photograph that arrives with no border of its
// own — from Wikimedia, or the house pool. The CSS draws the card around
// it: white deckle, art window, caption strip along the bottom.
//
// The commissioned pictures already have a torn border painted into them,
// so they get a different treatment entirely and nothing is drawn on top.
// See `components/beach/PlateCard.tsx`.
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

/**
 * The perforated score stamp. Top-left on every card.
 *
 * Everything about its size comes off one number, handed to CSS rather than
 * computed here, so a media query can shrink the whole stamp when the card it
 * sits on gets small — a 54px stamp on a 165px card is a third of the picture.
 */
export function ScoreStamp({ score, size = 1 }: { score: number; size?: number }) {
  return (
    <span
      className="score-stamp"
      style={{ "--stamp": stampInk(score), "--stamp-size": size } as React.CSSProperties}
      aria-label={`Safety score ${score} out of 100`}
    >
      <span className="n">{score}</span>
      <span className="cap">Safety</span>
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

  const art = (
    <Photo
      src={photo}
      original={supplied ? null : meta.image}
      fallback={supplied ? supplied.file : stand_in.file}
      alt={supplied || own ? `${meta.city}, ${meta.country}` : stand_in.place ?? ""}
      width={960}
      height={640}
    />
  )

  const link = (children: React.ReactNode) => (
    // The whole card is one link — a postcard is a single object.
    <Link
      href={meta.path}
      className="block rounded-[3px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]"
      aria-label={`Safety report for ${meta.city}, ${meta.country} — score ${meta.score} out of 100, ${level.label}`}
    >
      {children}
    </Link>
  )

  return link(
    <div className="postcard">
      <ScoreStamp score={meta.score} />
      {/* The postmark is 62px across. On a two-up phone grid that is most of
          the sky, so it stands down and leaves the picture alone. */}
      <span className="hidden sm:contents">
        <Postmark code={meta.countryCode} iso={meta.updatedAt} />
      </span>
      <div className="postcard-art aspect-[3/2]">
        {art}
        {/* When the photograph isn't of this place, say where it is.
            A card headed "Greetings from Monte Carlo" over an unlabelled
            beach in Rhodes is a small lie, and this site is supposed to
            be the one that doesn't tell them. */}
        {!own && stand_in.place && <span className="photo-elsewhere">{stand_in.place}</span>}
      </div>
      <div className="flex flex-wrap items-end justify-between gap-x-3 px-1 pb-2 pt-1.5 sm:pb-2.5 sm:pt-2">
        <div className="min-w-0 flex-1">
          <p className="postcard-greeting text-[0.56rem] sm:text-[0.68rem]">Greetings from</p>
          <p className="font-display truncate text-[1rem] font-medium leading-tight tracking-tight text-[var(--navy)] sm:text-[1.2rem]">
            {meta.city}
          </p>
          <p className="truncate text-[0.64rem] text-[var(--ink-faint)] sm:text-[0.7rem]">
            {meta.flag && <span className="mr-1">{meta.flag}</span>}
            {meta.country}
          </p>
        </div>
        {/* Mono, like every other verdict on the site: the rule is that a fact
            never wears the same face as a feeling. */}
        <p
          className="meta w-full shrink-0 pt-0.5 text-[0.52rem] sm:w-auto sm:pb-1 sm:pt-0 sm:text-[0.58rem]"
          style={{ color: stampInk(meta.score) }}
        >
          {level.label}
        </p>
      </div>
    </div>,
  )
}
