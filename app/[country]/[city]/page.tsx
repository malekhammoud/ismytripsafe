import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { cache } from "react"
import { getCityReport, getRelated } from "@/lib/reports"
import {
  computeCategories,
  computeFinalScore,
  scoreColor,
  LEVELS,
} from "@/lib/safety-display"
import { personalizeScore, type TravelerProfile } from "@/lib/profile"
import { sourceUrlForName } from "@/lib/source-links"
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
  FaqSection,
  ReportLinkGrid,
  SeoFooter,
  SiteHeader,
  scoreTint,
  type Crumb,
} from "@/components/seo/shared"
import { TrafficReport } from "@/components/report/TrafficReport"
import type { CachedReport } from "@/lib/cache"
import type { SafetySignal } from "@/lib/types"

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
  return computeFinalScore(report.bundle.safety, report.enrichment)
}

function sig(report: CachedReport, key: string): SafetySignal | undefined {
  return report.bundle.safety.signals.find((s) => s.key === key)
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
  if (!hit) notFound()
  const { report, meta } = hit

  const final = finalScoreOf(report)
  const categories = computeCategories(report.bundle.safety.signals)
  const capsule = buildCapsule(report)
  const related = await getRelated(meta)
  const e = report.enrichment
  const mapHref = `/map?place=${encodeURIComponent(`${meta.city}, ${meta.country}`)}`

  const trail: Crumb[] = [
    { name: "Home", href: "/" },
    { name: "Destinations", href: "/destinations" },
    { name: meta.country, href: `/${meta.countrySlug}` },
    { name: meta.city, href: meta.path },
  ]

  // At-a-glance table rows: only signals that actually resolved.
  const glanceKeys = [
    "advisory",
    "homicide",
    "safe_walking_dark",
    "numbeo_crime_index",
    "violence_victimization",
    "air_quality",
    "road_deaths",
    "natural_hazards",
  ]
  const glance = glanceKeys
    .map((k) => sig(report, k))
    .filter((s): s is SafetySignal => !!s && s.score != null)

  // Deterministic traveller-type scores (same arithmetic as the interactive
  // personalisation — unique numbers per city, no AI involved).
  const travellerRows: { label: string; profile: TravelerProfile }[] = [
    { label: "Solo traveller", profile: { party: "solo", age: "under30", style: "sightseeing" } },
    { label: "Solo, nightlife-focused", profile: { party: "solo", age: "under30", style: "nightlife" } },
    { label: "Family with kids", profile: { party: "family", age: "30to49", style: "sightseeing" } },
    { label: "Travellers 65+", profile: { party: "couple", age: "65plus", style: "sightseeing" } },
  ]

  const walkDark = sig(report, "safe_walking_dark")
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
      headline: `Is ${meta.city} Safe? Travel Safety Report`,
      description: metaDescription(report),
      image: report.images.hero,
    }),
    reportDatasetNode(meta)
  )

  return (
    <main className="relative z-10 mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <SiteHeader />
      <div className="mx-auto max-w-[720px]">
        <Breadcrumbs trail={trail} />

        {/* H1 + answer capsule — the self-contained, quotable verdict */}
        <h1 className="font-display text-[clamp(1.6rem,5vw,2.1rem)] font-medium leading-tight tracking-tight text-[var(--ink)]">
          Is {meta.city} safe? {meta.flag}
        </h1>
        <p className="mt-1 text-[0.8rem] text-[var(--ink-faint)]">
          {meta.country} · Safety report last updated{" "}
          <time dateTime={report.cachedAt}>{humanDate(report.cachedAt)}</time>
        </p>
        <p className="mt-4 text-[1rem] leading-relaxed text-[var(--ink)]">{capsule}</p>

        {/* The full interactive report card */}
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

        {/* At a glance — semantic table of the hard numbers */}
        {glance.length > 0 && (
          <section className="mt-10">
            <h2 className="font-display text-[1.35rem] font-medium tracking-tight text-[var(--ink)]">
              {meta.city} safety data at a glance
            </h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse text-[0.85rem]">
                <thead>
                  <tr className="border-b border-[var(--hairline)] text-left text-[0.7rem] uppercase tracking-[0.1em] text-[var(--ink-faint)]">
                    <th className="py-2 pr-3 font-semibold">Indicator</th>
                    <th className="py-2 pr-3 font-semibold">Value</th>
                    <th className="py-2 pr-3 font-semibold">Safety score</th>
                    <th className="py-2 font-semibold">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {glance.map((s) => (
                    <tr key={s.key} className="border-b border-[var(--hairline)]">
                      <td className="py-2 pr-3 font-medium text-[var(--ink)]">{s.label}</td>
                      <td className="tnum py-2 pr-3 text-[var(--ink-soft)]">{s.display}</td>
                      <td className="tnum py-2 pr-3 font-semibold" style={{ color: scoreColor(s.score as number) }}>
                        {s.score}/100
                      </td>
                      <td className="py-2 text-[0.78rem] text-[var(--ink-faint)]">
                        {sourceUrlForName(s.source) ? (
                          <a
                            href={sourceUrlForName(s.source) as string}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-[var(--accent)] hover:underline"
                          >
                            {s.source}
                          </a>
                        ) : (
                          s.source
                        )}
                        {s.year ? ` (${s.year})` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Neighbourhood zones — data the map page plots, as crawlable text */}
        {zones.length > 0 && (
          <section className="mt-10">
            <h2 className="font-display text-[1.35rem] font-medium tracking-tight text-[var(--ink)]">
              Safest areas and areas to avoid in {meta.city}
            </h2>
            <p className="mt-2 text-[0.9rem] leading-relaxed text-[var(--ink-soft)]">
              Our field research rated {zones.length} {meta.city} districts for visitors
              {safeZones.length ? `: ${safeZones.length} safer` : ""}
              {cautionZones.length ? `, ${cautionZones.length} needing caution` : ""}
              {avoidZones.length ? ` and ${avoidZones.length} best avoided` : ""}.{" "}
              <Link href={mapHref} className="font-medium text-[var(--accent-deep)] hover:underline">
                See them plotted on the {meta.city} safety map
              </Link>
              .
            </p>
            <div className="mt-3 space-y-2">
              {[...avoidZones, ...cautionZones, ...safeZones].map((z) => (
                <div key={z.name} className="card flex items-start gap-3 px-4 py-3">
                  <span
                    className="mt-[3px] h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{
                      background:
                        z.level === "avoid" ? "var(--risky)" : z.level === "caution" ? "var(--caution)" : "var(--safe)",
                    }}
                    aria-hidden
                  />
                  <p className="text-[0.88rem] leading-relaxed text-[var(--ink)]">
                    <strong>{z.name}</strong>
                    <span className="ml-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-[var(--ink-faint)]">
                      {z.level === "avoid" ? "avoid" : z.level === "caution" ? "caution" : "safer"}
                    </span>
                    <span className="block text-[var(--ink-soft)]">{z.note}</span>
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Night safety — self-contained section for the fan-out query */}
        <section className="mt-10">
          <h2 className="font-display text-[1.35rem] font-medium tracking-tight text-[var(--ink)]">
            Is {meta.city} safe at night?
          </h2>
          <div className="mt-2 space-y-2 text-[0.9rem] leading-relaxed text-[var(--ink-soft)]">
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
        </section>

        {/* Traveller-type scores — deterministic re-weighting, unique per city */}
        <section className="mt-10">
          <h2 className="font-display text-[1.35rem] font-medium tracking-tight text-[var(--ink)]">
            {meta.city} safety score by traveller type
          </h2>
          <p className="mt-2 text-[0.9rem] leading-relaxed text-[var(--ink-soft)]">
            Who&apos;s travelling changes which risks matter. These scores re-weight{" "}
            {meta.city}&apos;s category data (crime, health, stability) for common trip
            types — same data, different emphasis. Run your own profile from the{" "}
            <Link href={`/?place=${encodeURIComponent(`${meta.city}, ${meta.country}`)}`} className="font-medium text-[var(--accent-deep)] hover:underline">
              interactive checker
            </Link>
            .
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {travellerRows.map((row) => {
              const p = personalizeScore(final, categories, row.profile)
              return (
                <div key={row.label} className="card flex items-center justify-between gap-3 px-4 py-3">
                  <span>
                    <span className="block text-[0.88rem] font-semibold text-[var(--ink)]">{row.label}</span>
                    <span className="block text-[0.72rem] text-[var(--ink-faint)]">
                      {p.drivers.length ? p.drivers.join(" · ") : "Baseline weighting"}
                    </span>
                  </span>
                  <span
                    className="tnum flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[0.82rem] font-bold text-white"
                    style={{ background: scoreTint(p.index) }}
                  >
                    {p.index}
                  </span>
                </div>
              )
            })}
          </div>
        </section>

        {/* FAQ — visible HTML answers (no FAQ schema: retired by Google) */}
        <FaqSection
          title={`${meta.city} safety FAQ`}
          items={[
            {
              q: `Is ${meta.city} safe for tourists right now?`,
              a: (
                <p>
                  {e.verdict} {e.summary} (Assessed {humanDate(report.cachedAt)}.)
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
                      : e.avoidAreas.slice(0, 3).join("; ") + "."}{" "}
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
              q: `What are the most common scams in ${meta.city}?`,
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
              q: `How does ${meta.city} compare with other places in ${meta.country}?`,
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
              q: `How is this ${meta.city} safety score calculated?`,
              a: (
                <p>
                  The score blends {report.bundle.safety.sources.length || "15"}+ public data
                  sources — government advisories, UNODC/World Bank crime statistics, WHO health
                  data, live air quality and disaster alerts — with AI field research over current
                  local reporting. The databases carry 75% of the weight, field research 25%.{" "}
                  <Link href="/methodology" className="font-medium text-[var(--accent-deep)] hover:underline">
                    Full methodology
                  </Link>
                  .
                </p>
              ),
            },
          ]}
        />

        {/* Related reports — the internal-linking modules */}
        <ReportLinkGrid
          title={`More ${meta.country} safety reports`}
          items={related.sameCountry.slice(0, 6)}
        />
        <ReportLinkGrid
          title="Nearby destinations"
          items={related.nearby.slice(0, 4)}
          anchors={(m) => `${m.city} safety report`}
        />
        <ReportLinkGrid
          title="Destinations with a similar safety profile"
          items={related.similarScore.slice(0, 4)}
          anchors={(m) => `How safe is ${m.city}?`}
        />

        <p className="mt-8 text-[0.85rem] text-[var(--ink-soft)]">
          Browse the{" "}
          <Link href={`/${meta.countrySlug}`} className="font-medium text-[var(--accent-deep)] hover:underline">
            {meta.country} safety overview
          </Link>{" "}
          or{" "}
          <Link href="/destinations" className="font-medium text-[var(--accent-deep)] hover:underline">
            all destinations
          </Link>
          . Raw data:{" "}
          <a href={`${meta.path}/data.json`} className="font-medium text-[var(--accent-deep)] hover:underline">
            {meta.citySlug}.json
          </a>{" "}
          (CC BY 4.0).
        </p>

        <SeoFooter updatedAt={report.cachedAt} />
      </div>
    </main>
  )
}
