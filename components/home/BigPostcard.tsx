import Link from "next/link"
import Image from "next/image"
import { Eye, HandCoins, ShieldCheck } from "lucide-react"
import { ScoreRing } from "@/components/beach/ScoreRing"
import { CATEGORY_ICON } from "@/components/report/category-icons"
import { computeCategories, computeFinalScore, LEVELS, PYRAMID } from "@/lib/safety-display"
import { suppliedPhotoFor } from "@/lib/photos"
import type { CachedReport } from "@/lib/cache"
import type { ReportMeta } from "@/lib/reports"

// ─────────────────────────────────────────────────────────────────────
// One card, big, showing what a report actually says.
//
// The rest of the page is a set of small cards that link to reports. This
// one *is* a report, at a glance: the score, the answer in words, the five
// scores under it, and three sentences lifted straight out of the written
// briefing for that city. Someone who reads only this should know what they
// would get if they typed a place into the box.
//
// Every word and number is from the stored report. There is no lorem, no
// placeholder score, and no invented traveller: the site's own "written for
// you" briefing is personalised to a profile, and inventing a profile to
// make the demo look tailored would be the exact move this page is trying
// to be the opposite of.
//
// The briefing and the score row are each written once and *moved* by CSS
// rather than rendered twice and hidden — three paragraphs duplicated in the
// markup is three paragraphs a screen reader reads twice.
// ─────────────────────────────────────────────────────────────────────

/** How the three lines under "your trip, your risks" are chosen. */
const LINES = [
  { key: "verdict", icon: ShieldCheck, label: "The verdict" },
  { key: "robbery", icon: Eye, label: "Violent crime" },
  { key: "pickpocket", icon: HandCoins, label: "Petty theft" },
] as const

export function BigPostcard({ meta, report }: { meta: ReportMeta; report: CachedReport }) {
  const photo = suppliedPhotoFor(meta.path)
  if (!photo) return null

  const final = computeFinalScore(report.bundle.safety, report.enrichment)
  const level = LEVELS[final.level]
  const byKey = new Map(
    computeCategories(report.bundle.safety.signals, report.enrichment).map((c) => [c.key, c]),
  )
  const cats = PYRAMID.flat()
    .map((k) => byKey.get(k))
    .filter((c) => c != null && c.score != null)

  const e = report.enrichment
  const lines = [
    { ...LINES[0], text: e.verdict, level: null as string | null },
    { ...LINES[1], text: e.robbery?.note, level: e.robbery?.level ?? null },
    { ...LINES[2], text: e.pickpocket?.note, level: e.pickpocket?.level ?? null },
  ].filter((l) => !!l.text)

  const checked = new Date(meta.updatedAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  return (
    <Link
      href={meta.path}
      className="group block rounded-[4px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]"
      aria-label={`Read the full safety report for ${meta.city}, ${meta.country}`}
    >
      {/* `.postcard-hero` drops the CSS deckle: this photograph carries its own
          torn border, painted in, and two frames is one too many. */}
      <div className="postcard postcard-hero relative">
        <div className="relative aspect-[4/5] overflow-hidden sm:aspect-[16/9] lg:aspect-[2/1]">
          <Image
            src={photo.file}
            alt={`${meta.city}, ${meta.country}`}
            fill
            sizes="(max-width: 1024px) 100vw, 62rem"
            className="object-cover object-[36%_50%] transition-transform duration-[900ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] group-hover:scale-[1.03] sm:object-[50%_44%]"
          />
          {/* Two scrims, not one: the type on the left needs a dark ground, and
              the panel on the right needs a darker one still. A single flat
              overlay across the whole frame would take the sunset with it. */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(101deg, rgba(9,32,44,0.78) 0%, rgba(9,32,44,0.5) 34%, rgba(9,32,44,0.12) 56%, rgba(9,32,44,0.06) 100%)",
            }}
          />
          <div
            className="absolute inset-x-0 bottom-0 h-2/3"
            style={{ background: "linear-gradient(180deg, transparent, rgba(9,32,44,0.7))" }}
          />
          <span className="photo-elsewhere">Illustration</span>

          {/* ── The answer ─────────────────────────────────── */}
          <div className="absolute left-0 top-0 p-5 sm:p-7 lg:p-9">
            <p className="font-display text-[clamp(1.5rem,3.4vw,2.5rem)] font-medium leading-none tracking-tight text-[#fffdf6]">
              {meta.city} <span className="align-middle text-[0.7em]">{meta.flag}</span>
            </p>
            <p className="meta mt-1.5 text-[0.62rem] text-[rgba(255,253,246,0.6)]">{meta.country}</p>
            <div className="mt-4 sm:mt-5">
              <ScoreRing
                score={final.index}
                color={level.color}
                size={116}
                stroke={7}
                track="rgba(255,253,246,0.22)"
                onDark
              />
            </div>
            <p
              className="meta mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.6rem]"
              style={{ background: "rgba(255,253,246,0.92)", color: level.color }}
            >
              <ShieldCheck size={13} strokeWidth={2.4} />
              {level.answer}
            </p>
          </div>
        </div>

        {/* ── The five scores ──────────────────────────────────
            On paper under the photograph on a phone; lifted onto the
            photograph's bottom-left corner once there is room for them. */}
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 border-b border-[var(--hairline)] px-1 pb-3 pt-3 sm:absolute sm:bottom-0 sm:left-0 sm:border-0 sm:p-7 lg:p-9">
          {cats.map((c) => {
            const Icon = CATEGORY_ICON[c!.key]
            return (
              <li key={c!.key} className="flex items-center gap-1.5">
                <Icon size={12} strokeWidth={2.3} className="shrink-0" style={{ color: c!.color }} />
                <span className="text-[0.68rem] text-[var(--ink-faint)] sm:text-[rgba(255,253,246,0.74)]">
                  {c!.short}
                </span>
                <span className="tnum text-[0.76rem] font-bold text-[var(--ink)] sm:text-[#fffdf6]">
                  {c!.score}
                </span>
              </li>
            )
          })}
        </ul>

        {/* ── The written briefing ─────────────────────────────
            The same element in both places: on paper beneath the card, and
            floated over the photograph's bottom-right corner at lg. */}
        <div className="px-1 pb-3 pt-3.5 lg:absolute lg:bottom-4 lg:right-4 lg:w-[22rem] lg:rounded-[6px] lg:border lg:border-[rgba(140,225,190,0.34)] lg:bg-[rgba(8,28,38,0.7)] lg:p-4 lg:backdrop-blur-[7px] xl:w-[25rem]">
          {/* Not `.postcard-greeting`: that class is declared after Tailwind's
              layer in globals.css, so at equal specificity it wins over the
              `lg:` overrides and the label stays orange serif on the dark
              panel. Spelled out in utilities instead, both ways. */}
          <p className="font-display text-[0.68rem] font-medium italic uppercase tracking-[0.16em] text-[var(--orange-deep)] lg:[font-family:var(--font-sans)] lg:text-[0.6rem] lg:font-bold lg:not-italic lg:text-[rgba(140,225,190,0.9)]">
            Written for you
          </p>
          <p className="font-display mt-1 hidden text-[1.05rem] font-medium leading-tight text-[#fffdf6] lg:block">
            Your trip, your risks
          </p>
          <ul className="mt-2 space-y-2 lg:mt-2.5">
            {lines.map((l) => (
              <li key={l.key}>
                <p className="flex items-center gap-1.5 text-[0.58rem] font-bold uppercase tracking-[0.11em] text-[var(--ink-faint)] lg:text-[rgba(255,253,246,0.56)]">
                  <l.icon size={10} strokeWidth={2.4} />
                  {l.label}
                  {l.level ? ` · ${l.level}` : ""}
                </p>
                <p className="mt-0.5 text-[0.78rem] leading-[1.55] text-[var(--ink-soft)] lg:text-[0.72rem] lg:leading-[1.5] lg:text-[rgba(255,253,246,0.9)]">
                  {l.text}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[0.66rem] text-[var(--ink-faint)] lg:border-t lg:border-[rgba(255,253,246,0.18)] lg:pt-2 lg:text-[0.6rem] lg:text-[rgba(255,253,246,0.5)]">
            Checked {checked} · conditions change, so re-run it before you fly
          </p>
        </div>
      </div>

      <p className="mt-3 text-center text-[0.82rem] font-semibold text-[var(--accent-deep)] group-hover:underline">
        Read the full {meta.city} report →
      </p>
    </Link>
  )
}
