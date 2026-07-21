import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { cache } from "react"
import { getCountryHub, listCountries } from "@/lib/reports"
import { readCacheAnyAge, type CachedReport } from "@/lib/cache"
import { LEVELS } from "@/lib/safety-display"
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
  RankedCityList,
  ReportDoc,
  SectionHeading,
  SeoFooter,
  SignalTable,
  SiteHeader,
  scoreTint,
  sectionNumberer,
  type Crumb,
} from "@/components/seo/shared"
import { TrafficReport } from "@/components/report/TrafficReport"
import type { SafetySignal } from "@/lib/types"

export const dynamic = "force-dynamic"

interface Params {
  country: string
}

const load = cache(async (countrySlug: string) => {
  const hub = await getCountryHub(countrySlug.toLowerCase())
  if (!hub) return null
  // The freshest full report in the country supplies the country-level data
  // (advisories and most signals are national anyway).
  const freshestKey = [hub.countryReport, ...hub.cities]
    .filter(Boolean)
    .sort((a, b) => ((a!.updatedAt < b!.updatedAt ? 1 : -1)))[0]?.key
  const sample = freshestKey ? await readCacheAnyAge(freshestKey) : null
  const countryReport = hub.countryReport
    ? await readCacheAnyAge(hub.countryReport.key)
    : null
  return { hub, sample, countryReport }
})

const COUNTRY_SIGNAL_KEYS = [
  "advisory",
  "homicide",
  "safe_walking_dark",
  "violence_victimization",
  "stability",
  "rule_of_law",
  "road_deaths",
]

function countrySignals(sample: CachedReport | null): SafetySignal[] {
  if (!sample) return []
  return COUNTRY_SIGNAL_KEYS.map((k) =>
    sample.bundle.safety.signals.find((s) => s.key === k)
  ).filter((s): s is SafetySignal => !!s && s.score != null)
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>
}): Promise<Metadata> {
  const { country } = await params
  const data = await load(country)
  if (!data) return { title: "Not found" }
  const { hub, sample } = data
  const year = new Date(hub.updatedAt).getFullYear()
  const adv = sample?.bundle.safety.advisories.find((a) => a.sourceShort === "US")
  const title = `Is ${hub.country} Safe in ${year}? Advisories, Crime Data & City Scores`
  const description =
    `${hub.country} travel safety: ${adv ? `US advisory Level ${adv.level} (${adv.levelLabel}). ` : ""}` +
    `Safety scores for ${hub.cities.length || "its"} destination${hub.cities.length === 1 ? "" : "s"}, ` +
    `crime and governance data, and current risks — updated ${monthYear(hub.updatedAt)}.`
  return {
    title,
    description,
    alternates: { canonical: `/${hub.countrySlug}` },
    openGraph: {
      title,
      description,
      url: absUrl(`/${hub.countrySlug}`),
      siteName: "IsMyTripSafe",
      type: "article",
    },
  }
}

export default async function CountryHubPage({
  params,
}: {
  params: Promise<Params>
}) {
  const { country } = await params
  const data = await load(country)
  if (!data) notFound()
  const { hub, sample, countryReport } = data

  const trail: Crumb[] = [
    { name: "Home", href: "/" },
    { name: "Destinations", href: "/destinations" },
    { name: hub.country, href: `/${hub.countrySlug}` },
  ]

  const advisories = sample?.bundle.safety.advisories ?? []
  const signals = countrySignals(countryReport ?? sample)
  const usAdv = advisories.find((a) => a.sourceShort === "US" && a.level != null)

  const headline = hub.countryReport
    ? { score: hub.countryReport.score, level: hub.countryReport.level }
    : hub.avgScore != null
      ? { score: hub.avgScore, level: null }
      : null

  const best = hub.cities[0]
  const worst = hub.cities.length > 1 ? hub.cities[hub.cities.length - 1] : null

  const capsule =
    `As of ${monthYear(hub.updatedAt)}, ${hub.country} ` +
    (headline
      ? `scores ${headline.score}/100 on the IsMyTripSafe safety index` +
        (headline.level ? ` — verdict: ${LEVELS[headline.level].answer.toLowerCase()}` : hub.countryReport ? "" : " (average across assessed destinations)")
      : "has assessed destinations listed below") +
    `. ` +
    (usAdv ? `The U.S. State Department rates ${hub.country} Level ${usAdv.level}: ${usAdv.levelLabel}. ` : "") +
    (best
      ? `Of the ${hub.cities.length} ${hub.country} destination${hub.cities.length === 1 ? "" : "s"} assessed, ${best.city} scores highest (${best.score}/100)` +
        (worst ? `, while ${worst.city} scores lowest (${worst.score}/100).` : ".")
      : "")

  const countryMeta = hub.countryReport
  const jsonLd = graph(
    organizationNode(),
    websiteNode(),
    breadcrumbNode(trail),
    ...(countryMeta && countryReport
      ? [
          reportArticleNode({
            meta: countryMeta,
            headline: `Is ${hub.country} Safe? Travel Safety Report`,
            description: capsule.slice(0, 300),
            image: countryReport.images.hero,
          }),
          reportDatasetNode(countryMeta),
        ]
      : [
          {
            "@type": "CollectionPage",
            "@id": `${absUrl(`/${hub.countrySlug}`)}#page`,
            name: `Is ${hub.country} Safe? Destination safety reports`,
            url: absUrl(`/${hub.countrySlug}`),
            isPartOf: { "@id": `${absUrl("/")}#website` },
            dateModified: hub.updatedAt,
          },
        ])
  )

  // With a full country report, its card carries sections 01–05 and the doc
  // below continues at 06; without one, the doc starts the numbering itself.
  const num = sectionNumberer(countryReport ? 5 : 0)

  const faqItems = [
    {
      q: `Is ${hub.country} safe to visit right now?`,
      a: (
        <p>
          {usAdv
            ? `The U.S. State Department currently rates ${hub.country} Level ${usAdv.level} of 4 — ${usAdv.levelLabel}. `
            : ""}
          {headline
            ? `On our composite index ${hub.country} ${hub.countryReport ? "scores" : "averages"} ${headline.score}/100. `
            : ""}
          See the destination reports above for city-level detail. (Updated {humanDate(hub.updatedAt)}.)
        </p>
      ),
    },
    best
      ? {
          q: `What is the safest place to visit in ${hub.country}?`,
          a: (
            <p>
              Of the destinations we&apos;ve assessed, <Link href={best.path} className="font-medium text-[var(--accent-deep)] hover:underline">{best.city}</Link> currently
              scores highest at {best.score}/100 ({LEVELS[best.level].label}).
              {worst && worst.path !== best.path
                ? ` ${worst.city} scores lowest at ${worst.score}/100.`
                : ""}
            </p>
          ),
        }
      : { q: "", a: null },
    {
      q: `Where does this ${hub.country} safety data come from?`,
      a: (
        <p>
          Directly from public sources: US, UK and Canadian government advisories, World
          Bank and UNODC crime statistics, WHO health data, live air-quality, disaster
          and earthquake feeds — plus AI field research over current local reporting.{" "}
          <Link href="/methodology" className="font-medium text-[var(--accent-deep)] hover:underline">
            Read the full methodology
          </Link>
          .
        </p>
      ),
    },
  ]

  return (
    <>
      <SiteHeader />
      <main className="relative z-10 mx-auto max-w-4xl px-4 py-7 sm:px-6">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
        <div className="mx-auto max-w-[640px]">
          <Breadcrumbs trail={trail} />

          <h1 className="font-display text-[clamp(1.7rem,5vw,2.3rem)] font-medium leading-tight tracking-tight text-[var(--ink)]">
            Is {hub.country} safe? {hub.flag}
          </h1>
          <p className="mt-1.5 text-[0.8rem] text-[var(--ink-faint)]">
            {hub.region} · Updated <time dateTime={hub.updatedAt}>{humanDate(hub.updatedAt)}</time>
          </p>
          <p className="mt-4 text-[1rem] leading-[1.75] text-[var(--ink)]">{capsule}</p>

          {/* Country-level full report when one was generated */}
          {countryReport && (
            <div className="mt-7">
              <TrafficReport
                bundle={countryReport.bundle}
                images={countryReport.images}
                intel={countryReport.enrichment}
                prose={countryReport.prose}
                searchQueries={[]}
                loading={false}
                generatedAt={humanDate(countryReport.cachedAt)}
                heroHeading="h2"
              />
            </div>
          )}

          <div className={countryReport ? "mt-8" : "mt-7"}>
            <ReportDoc>
              {/* Official advisories — only when no full report shows them already */}
              {!countryReport && advisories.length > 0 && (
                <DocSection
                  num={num()}
                  kicker="Official Guidance"
                  title="Government advisories"
                  pill={usAdv ? `US Level ${usAdv.level}` : undefined}
                  first
                >
                  <div className="space-y-3">
                    {advisories.map((a) => (
                      <article
                        key={a.source}
                        className="rounded-[3px] px-4 py-3.5"
                        style={{
                          background: "rgba(20,25,34,0.03)",
                          borderLeft: `3px solid ${
                            a.level && a.level >= 3 ? "var(--risky)" : a.level === 2 ? "var(--caution)" : "var(--safe)"
                          }`,
                        }}
                      >
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-[var(--ink-faint)]">
                            {a.source}
                          </p>
                          {a.level != null && (
                            <span className="tnum shrink-0 text-[0.7rem] font-bold text-[var(--ink)]">Level {a.level}</span>
                          )}
                        </div>
                        <p className="mt-1 text-[0.92rem] font-semibold text-[var(--ink)]">{a.levelLabel || a.headline}</p>
                        {a.summary && <p className="mt-1 text-[0.82rem] leading-relaxed text-[var(--ink-soft)]">{a.summary}</p>}
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1.5 inline-block text-[0.72rem] font-semibold text-[var(--accent-deep)] hover:underline"
                        >
                          Full advisory →
                        </a>
                      </article>
                    ))}
                  </div>
                </DocSection>
              )}

              {/* City reports, ranked — every city page gets its hub inlink here */}
              {hub.cities.length > 0 && (
                <DocSection
                  num={num()}
                  kicker="Destinations"
                  title={`${hub.country} destinations by safety score`}
                  pill={`${hub.cities.length} assessed`}
                  first={!!countryReport || advisories.length === 0}
                >
                  <RankedCityList items={hub.cities} />
                  <p className="mt-4 text-[0.82rem] text-[var(--ink-soft)]">
                    Missing a place?{" "}
                    <Link href="/" className="font-medium text-[var(--accent-deep)] hover:underline">
                      Generate its report in about a minute
                    </Link>
                    .
                  </p>
                </DocSection>
              )}

              {/* Country-level data table — only when no full report renders it */}
              {!countryReport && signals.length > 0 && (
                <DocSection num={num()} kicker="Evidence Signals" title={`${hub.country} safety data`}>
                  <SignalTable signals={signals} />
                </DocSection>
              )}

              <DocSection num={num()} kicker="Questions" title={`${hub.country} safety FAQ`}>
                <FaqList items={faqItems} />
              </DocSection>
            </ReportDoc>
          </div>

          <RegionLinks currentSlug={hub.countrySlug} region={hub.region} />

          <SeoFooter updatedAt={hub.updatedAt} />
        </div>
      </main>
    </>
  )
}

async function RegionLinks({ currentSlug, region }: { currentSlug: string; region: string }) {
  const all = (await listCountries()).filter((c) => c.countrySlug !== currentSlug)
  const sameRegion = all.filter((c) => c.region === region).slice(0, 6)
  const items = sameRegion.length ? sameRegion : all.slice(0, 6)
  if (!items.length) return null
  return (
    <section className="mt-9">
      <SectionHeading>{sameRegion.length ? `More of ${region}` : "Other countries"}</SectionHeading>
      <div className="mt-3.5 flex flex-wrap gap-2">
        {items.map((c) => (
          <Link
            key={c.countrySlug}
            href={`/${c.countrySlug}`}
            className="card px-3.5 py-2 text-[0.84rem] font-medium text-[var(--ink)] transition-shadow hover:shadow-[var(--shadow-float)]"
          >
            {c.flag && <span className="mr-1.5">{c.flag}</span>}
            Is {c.country} safe?
            {c.countryReport || c.avgScore != null ? (
              <span
                className="tnum ml-2 rounded-full px-1.5 py-0.5 text-[0.7rem] font-bold text-white"
                style={{ background: scoreTint(c.countryReport?.score ?? (c.avgScore as number)) }}
              >
                {c.countryReport?.score ?? c.avgScore}
              </span>
            ) : null}
          </Link>
        ))}
      </div>
    </section>
  )
}
