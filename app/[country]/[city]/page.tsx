import type { Metadata } from "next"
import Link from "next/link"
import { notFound, permanentRedirect } from "next/navigation"
import { cache } from "react"
import { findCityElsewhere, getCityReport, getRelated } from "@/lib/reports"
import { computeFinalScore, LEVELS } from "@/lib/safety-display"
import { absUrl, humanDate, monthYear } from "@/lib/site"
import {
  breadcrumbNode,
  graph,
  organizationNode,
  reportArticleNode,
  reportDatasetNode,
  websiteNode,
} from "@/lib/seo/jsonld"
import {
  Breadcrumbs,
  DocSection,
  FaqList,
  ReportDoc,
  SeoFooter,
  SiteHeader,
  sectionNumberer,
  type Crumb,
} from "@/components/seo/shared"
import { TrafficReport } from "@/components/report/TrafficReport"
import { RelatedGrid } from "@/components/seo/DestinationCards"
import { ReportJumpNav, BackToTopPill } from "@/components/report/ReportJumpNav"
import type { CachedReport } from "@/lib/cache"
import { ArrowRight, Globe2, Map as MapIcon, SlidersHorizontal } from "lucide-react"

// Always render fresh from the report store — new and refreshed reports
// appear immediately, and Googlebot/AI crawlers get full HTML.
export const dynamic = "force-dynamic"

interface Params {
  country: string
  city: string
}

const load = cache(async (country: string, city: string) =>
  getCityReport(country.toLowerCase(), city.toLowerCase())
)

// ─── Deterministic content built from the report data ────────────────

function finalScoreOf(report: CachedReport) {
  return computeFinalScore(
    report.bundle.safety,
    report.enrichment,
    report.bundle.geo?.countryCode
  )
}

/** The 40–75-word dated answer capsule at the top of the page. */
function buildCapsule(report: CachedReport): string {
  const { geo } = report
  const final = finalScoreOf(report)
  const level = LEVELS[final.level]
  const e = report.enrichment
  const risks: string[] = []
  if (e.pickpocket?.level && e.pickpocket.level !== "Low") {
    risks.push(`pickpocketing (${e.pickpocket.level.toLowerCase()} risk)`)
  }
  if (e.robbery?.level && e.robbery.level !== "Low") {
    risks.push(`robbery (${e.robbery.level.toLowerCase()} risk)`)
  }
  if (e.scams?.length && risks.length < 2) risks.push("tourist-targeted scams")
  const riskSentence = risks.length
    ? `The main risks for visitors are ${risks.join(" and ")}.`
    : `Street crime against visitors is limited; take normal precautions.`
  const advisory = report.bundle.safety.advisories.find(
    (a) => a.sourceShort === "US" && a.level != null
  )
  const advSentence = advisory
    ? ` The U.S. State Department rates it Level ${advisory.level} (${advisory.levelLabel}).`
    : ""
  return (
    `As of ${monthYear(report.cachedAt)}, ${geo.city} scores ${final.index}/100 on the ` +
    `IsMyTripSafe composite safety index — verdict: ${level.answer.toLowerCase()}. ` +
    `${e.verdict} ${riskSentence}${advSentence}`
  )
}

function metaDescription(report: CachedReport): string {
  const final = finalScoreOf(report)
  const { geo } = report
  const adv = report.bundle.safety.advisories.find((a) => a.sourceShort === "US")
  return (
    `${geo.city} safety score: ${final.index}/100 (${LEVELS[final.level].label}). ` +
    `${adv ? `US advisory Level ${adv.level}. ` : ""}` +
    `Crime data, safe and unsafe areas, scams and live advisories for ${geo.city}, ` +
    `${geo.country} — updated ${monthYear(report.cachedAt)}.`
  ).slice(0, 300)
}

// ─── Metadata ────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>
}): Promise<Metadata> {
  const { country, city } = await params
  const hit = await load(country, city)
  if (!hit) return { title: "Report not found" }
  const { report, meta } = hit
  const year = new Date(report.cachedAt).getFullYear()
  const title = `Is ${meta.city} Safe in ${year}? Safety Score ${meta.score}/100`
  return {
    title,
    description: metaDescription(report),
    alternates: { canonical: meta.path },
    openGraph: {
      title,
      description: metaDescription(report),
      url: absUrl(meta.path),
      siteName: "IsMyTripSafe",
      type: "article",
      // images intentionally omitted — the generated opengraph-image.tsx
      // score card is the share image.
    },
    twitter: { card: "summary_large_image" },
  }
}

// ─── Page ────────────────────────────────────────────────────────────

export default async function CityReportPage({
  params,
}: {
  params: Promise<Params>
}) {
  const { country, city } = await params
  const hit = await load(country, city)
  if (!hit) {
    // The report may simply have moved country — see `findCityElsewhere`.
    const moved = await findCityElsewhere(city.toLowerCase())
    if (moved) permanentRedirect(moved.path)
    notFound()
  }
  const { report, meta } = hit

  const final = finalScoreOf(report)
  const capsule = buildCapsule(report)
  const related = await getRelated(meta)
  const e = report.enrichment
  const mapHref = `/map?place=${encodeURIComponent(`${meta.city}, ${meta.country}`)}`
  const year = new Date(report.cachedAt).getFullYear()
  const personalizeHref =
    `/?place=${encodeURIComponent(`${meta.city}, ${meta.country}`)}`

  const trail: Crumb[] = [
    { name: "Home", href: "/" },
    { name: "Destinations", href: "/destinations" },
    { name: meta.country, href: `/${meta.countrySlug}` },
    { name: meta.city, href: meta.path },
  ]

  const walkDark = report.bundle.safety.signals.find((s) => s.key === "safe_walking_dark")
  const zones = e.mapZones ?? []
  const avoidZones = zones.filter((z) => z.level === "avoid")
  const cautionZones = zones.filter((z) => z.level === "caution")
  const safeZones = zones.filter((z) => z.level === "safe")

  const countryRank =
    related.sameCountry.length > 0
      ? [meta, ...related.sameCountry].sort((a, b) => b.score - a.score).findIndex((m) => m.path === meta.path) + 1
      : null

  const jsonLd = graph(
    organizationNode(),
    websiteNode(),
    breadcrumbNode(trail),
    reportArticleNode({
      meta,
      headline: `Is ${meta.city} Safe in ${new Date(report.cachedAt).getFullYear()}? Travel Safety Report`,
      description: metaDescription(report),
      image: report.images.hero,
    }),
    reportDatasetNode(meta)
  )

  // The TrafficReport carries sections 01–05; these continue the document.
  const num = sectionNumberer(5)

  return (
    <>
      <SiteHeader />
      <main className="relative z-10 mx-auto max-w-4xl px-4 py-7 sm:px-6">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
        <div className="mx-auto max-w-[640px]">
          <Breadcrumbs trail={trail} />

          {/* The whole report on one page — the jump menu keeps it navigable.
              Every pill is an anchor: no JS, always works, each a click. */}
          <ReportJumpNav
            items={[
              { label: "The verdict", href: "#report-hero" },
              { label: "Crime", href: "#sec-crime" },
              { label: "Advisories", href: "#sec-advisories" },
              { label: "On the ground", href: "#sec-local-intel" },
              { label: "Health", href: "#sec-health" },
              { label: "Stability", href: "#sec-stability" },
              ...(zones.length > 0 ? [{ label: "Districts", href: "#sec-districts" }] : []),
              { label: "Night safety", href: "#sec-night" },
              { label: "FAQ", href: "#sec-faq" },
            ]}
          />

          {/* The one action on the page — big, orange, and explicit. Personalisation
              is the whole point of the checker, and it starts the interactive flow
              with this place pre-filled. */}
          <Link
            href={`/?place=${encodeURIComponent(`${meta.city}, ${meta.country}`)}`}
            className="group mt-4 flex items-center gap-3.5 rounded-[14px] bg-[var(--orange-deep)] px-5 py-4 transition-transform hover:-translate-y-0.5 hover:bg-[#c03f21]"
            style={{
              color: "#fff8ec",
              boxShadow:
                "0 1px 2px rgba(140,48,22,0.24), 0 8px 20px -10px rgba(140,48,22,0.5)",
            }}
          >
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
              style={{ background: "rgba(255,248,236,0.18)" }}
            >
              <SlidersHorizontal size={20} />
            </span>
            <span className="min-w-0">
              <span className="block text-[1.02rem] font-bold leading-tight">
                Personalize Report Now
              </span>
              <span className="mt-0.5 block text-[0.78rem] leading-snug" style={{ color: "rgba(255,248,236,0.9)" }}>
                Tailor this report specifically to you and get the latest and most valuable
                insights with one click.
              </span>
            </span>
            <ArrowRight
              size={18}
              className="ml-auto shrink-0 transition-transform group-hover:translate-x-0.5"
            />
          </Link>

          {/* H1 + answer capsule — the self-contained, quotable verdict */}
          <h1 className="font-display text-[clamp(1.7rem,5vw,2.3rem)] font-medium leading-tight tracking-tight text-[var(--ink)]">
            Is {meta.city} safe? {meta.flag}
          </h1>
          <p className="mt-1.5 text-[0.8rem] text-[var(--ink-faint)]">
            {meta.country} · Safety report last updated{" "}
            <time dateTime={report.cachedAt}>{humanDate(report.cachedAt)}</time>
          </p>
          <p className="mt-4 text-[1rem] leading-[1.75] text-[var(--ink)]">{capsule}</p>

          {/* The full report card — sections 01–05 */}
          <div className="mt-7">
            <TrafficReport
              bundle={report.bundle}
              images={report.images}
              intel={report.enrichment}
              prose={report.prose}
              searchQueries={[]}
              loading={false}
              generatedAt={humanDate(report.cachedAt)}
              heroHeading="h2"
            />
          </div>

          {/* Continuation document — sections 06+ in the same dossier style */}
          <div className="mt-8">
            <ReportDoc>
              {zones.length > 0 && (
                <DocSection
                  num={num()}
                  kicker="Neighbourhoods"
                  title={`Safest areas and areas to avoid`}
                  pill={`${zones.length} districts`}
                  id="sec-districts"
                  first
                >
                  <p className="text-[0.88rem] leading-relaxed text-[var(--ink-soft)]">
                    Our field research rated {zones.length} {meta.city} districts for visitors
                    {safeZones.length ? `: ${safeZones.length} safer` : ""}
                    {cautionZones.length ? `, ${cautionZones.length} needing caution` : ""}
                    {avoidZones.length ? ` and ${avoidZones.length} best avoided` : ""}.{" "}
                    <Link href={mapHref} className="font-medium text-[var(--accent-deep)] hover:underline">
                      See them plotted on the {meta.city} safety map
                    </Link>
                    .
                  </p>
                  <div className="mt-4 space-y-2">
                    {[...avoidZones, ...cautionZones, ...safeZones].map((z) => (
                      <article
                        key={z.name}
                        className="rounded-[3px] px-4 py-3"
                        style={{
                          background: "rgba(20,25,34,0.03)",
                          borderLeft: `3px solid ${
                            z.level === "avoid" ? "var(--risky)" : z.level === "caution" ? "var(--caution)" : "var(--safe)"
                          }`,
                        }}
                      >
                        <p className="text-[0.88rem] leading-relaxed text-[var(--ink)]">
                          <strong>{z.name}</strong>
                          <span className="ml-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[var(--ink-faint)]">
                            {z.level === "avoid" ? "avoid" : z.level === "caution" ? "caution" : "safer"}
                          </span>
                          <span className="block text-[var(--ink-soft)]">{z.note}</span>
                        </p>
                      </article>
                    ))}
                  </div>

                  {/* the district map — the most visual thing on the page, and
                      the click that opens it should be impossible to miss */}
                  <div className="mt-5 flex flex-wrap items-center gap-2.5">
                    <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.72rem] font-semibold" style={{ background: "rgba(23,160,95,0.12)", color: "var(--safe)" }}>
                      {safeZones.length} safer
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.72rem] font-semibold" style={{ background: "rgba(226,106,44,0.14)", color: "var(--caution)" }}>
                      {cautionZones.length} caution
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.72rem] font-semibold" style={{ background: "rgba(214,69,65,0.12)", color: "var(--risky)" }}>
                      {avoidZones.length} avoid
                    </span>
                    <Link
                      href={mapHref}
                      className="btn ml-auto inline-flex items-center gap-2 px-4 py-2 text-[0.82rem] font-semibold"
                    >
                      <MapIcon size={14} />
                      Open the district map
                    </Link>
                  </div>
                </DocSection>
              )}

              {/* Night safety — self-contained section for the fan-out query */}
              <DocSection
                num={num()}
                kicker="After Dark"
                title={`Is ${meta.city} safe at night?`}
                first={zones.length === 0}
                id="sec-night"
              >
                <div className="space-y-2.5 text-[0.9rem] leading-relaxed text-[var(--ink-soft)]">
                  {walkDark?.value != null && (
                    <p>
                      {(walkDark.value as number).toFixed(0)}% of people in {meta.country} say they
                      feel safe walking alone at night in their area (UN SDG survey
                      {walkDark.year ? `, ${walkDark.year}` : ""}).
                    </p>
                  )}
                  {e.robbery?.note && <p>{e.robbery.note}</p>}
                  {cautionZones.length + avoidZones.length > 0 ? (
                    <p>
                      After dark, be most careful around{" "}
                      {[...avoidZones, ...cautionZones]
                        .slice(0, 4)
                        .map((z) => z.name)
                        .join(", ")}
                      . Stick to busy, well-lit streets and licensed taxis or ride-hail late at night.
                    </p>
                  ) : (
                    <p>
                      No specific districts were flagged as no-go areas after dark, but the usual
                      night-time rules apply: stay in lit, populated areas and keep your phone out of sight.
                    </p>
                  )}
                </div>
              </DocSection>

              {/* FAQ — visible HTML answers (no JSON schema: retired by Google) */}
              <DocSection num={num()} kicker="Questions" title={`${meta.city} safety FAQ (${year})`} id="sec-faq">
                <FaqList
                  items={[
                    {
                      q: `Is ${meta.city} safe right now (${year})?`,
                      a: (
                        <p>
                          {e.verdict} {e.summary} (Assessed {humanDate(report.cachedAt)}.)
                        </p>
                      ),
                    },
                    {
                      q: `Is ${meta.city} safe for women, families and solo travelers?`,
                      a: (
                        <p>
                          Safety is not one number, and this {meta.city} report does not
                          pretend it is: the score is re-weighted for who is travelling.
                          A woman travelling alone, a family with children and a solo
                          backpacker face different street-level risks, so the headline
                          score shifts and the report leads with the findings that matter
                          for that group.{" "}
                          <Link
                            href={personalizeHref}
                            className="font-medium text-[var(--accent-deep)] hover:underline"
                          >
                            Personalize this report
                          </Link>{" "}
                          in one click to see the {year} score and safety briefing for
                          your specific travellers.
                        </p>
                      ),
                    },
                    {
                      q: `Which areas of ${meta.city} should tourists avoid?`,
                      a:
                        avoidZones.length || e.avoidAreas?.length ? (
                          <p>
                            {avoidZones.length
                              ? `Field research flags ${avoidZones.map((z) => z.name).join(", ")} as best avoided.`
                              : (e.avoidAreas ?? []).slice(0, 3).join("; ") + "."}{" "}
                            <Link href={mapHref} className="font-medium text-[var(--accent-deep)] hover:underline">
                              See the district-by-district safety map
                            </Link>
                            .
                          </p>
                        ) : (
                          <p>No districts were flagged as no-go areas for visitors at the last assessment.</p>
                        ),
                    },
                    {
                      q: `What are the most common scams in ${meta.city} (${year})?`,
                      a: e.scams?.length ? (
                        <ul className="list-disc pl-5">
                          {e.scams.slice(0, 4).map((s) => (
                            <li key={s}>{s}</li>
                          ))}
                        </ul>
                      ) : (
                        <p>No widespread visitor-targeted scams were identified in the latest research.</p>
                      ),
                    },
                    {
                      q: `How does ${meta.city} compare with other places in ${meta.country} (${year})?`,
                      a:
                        countryRank && related.sameCountry.length ? (
                          <p>
                            {meta.city} ranks #{countryRank} of {related.sameCountry.length + 1}{" "}
                            {meta.country} destinations we&apos;ve assessed, scoring {meta.score}/100. See the{" "}
                            <Link href={`/${meta.countrySlug}`} className="font-medium text-[var(--accent-deep)] hover:underline">
                              {meta.country} safety overview
                            </Link>{" "}
                            for the full list.
                          </p>
                        ) : (
                          <p>
                            {meta.city} scores {meta.score}/100 — see the{" "}
                            <Link href={`/${meta.countrySlug}`} className="font-medium text-[var(--accent-deep)] hover:underline">
                              {meta.country} safety overview
                            </Link>{" "}
                            for country-level data.
                          </p>
                        ),
                    },
                    {
                      q: `How is this ${city} safety score calculated (${year})?`,
                      a: (
                        <p>
                          The score blends {report.bundle.safety.sources.length || "15"}+ public data
                          sources — government advisories, UNODC/World Bank crime statistics, FBI crime
                          data for U.S. cities, WHO health data, live air quality and disaster alerts —
                          with AI field research over current local reporting. The databases carry the
                          bulk of the weight{report.bundle.geo.countryCode === "US"
                            ? " (and U.S. reports lean more on the latest field research)"
                            : ""}; the traveller-sentiment
                          score from field research carries the rest.{" "}
                          <Link href="/methodology" className="font-medium text-[var(--accent-deep)] hover:underline">
                            Full methodology
                          </Link>
                          .
                        </p>
                      ),
                    },
                  ]}
                />
              </DocSection>
            </ReportDoc>
          </div>

          {/* Related reports — doors to more, not lines of text */}
          <RelatedGrid
            title={`More ${meta.country} reports`}
            items={related.sameCountry.slice(0, 6)}
          />
          <RelatedGrid title="Nearby destinations" items={related.nearby.slice(0, 4)} />
          <RelatedGrid title="Similar safety profile" items={related.similarScore.slice(0, 4)} />

          {/* Keep exploring — one last, impossible-to-miss row of doors */}
          <section className="card mt-10 px-6 py-6 text-center">
            <p className="postcard-greeting">Keep exploring</p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
              <Link
                href={mapHref}
                className="btn inline-flex items-center gap-2 px-4 py-2 text-[0.84rem] font-semibold"
              >
                <MapIcon size={14} />
                {meta.city} district map
              </Link>
              <Link
                href={`/${meta.countrySlug}`}
                className="btn-secondary inline-flex items-center gap-2 rounded-full border border-[var(--hairline)] px-4 py-2 text-[0.84rem] font-semibold text-[var(--ink-soft)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent-deep)]"
              >
                All of {meta.country}
              </Link>
              <Link
                href="/destinations"
                className="btn-secondary inline-flex items-center gap-2 rounded-full border border-[var(--hairline)] px-4 py-2 text-[0.84rem] font-semibold text-[var(--ink-soft)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent-deep)]"
              >
                <Globe2 size={14} />
                Spin the globe
              </Link>
              <BackToTopPill />
            </div>
          </section>

          <p className="mt-6 text-center text-[0.8rem] text-[var(--ink-faint)]">
            Raw data:{" "}
            <a href={`${meta.path}/data.json`} className="font-medium text-[var(--accent-deep)] hover:underline">
              {meta.citySlug}.json
            </a>{" "}
            (CC BY 4.0).
          </p>

          <SeoFooter updatedAt={report.cachedAt} />
        </div>
      </main>
    </>
  )
}
