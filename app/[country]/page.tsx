import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { cache } from "react"
import { getCountryHub, listCountries } from "@/lib/reports"
import { readCacheAnyAge, type CachedReport } from "@/lib/cache"
import { LEVELS, scoreColor } from "@/lib/safety-display"
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
  ReportLink,
  SeoFooter,
  SiteHeader,
  scoreTint,
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
  "corruption",
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

  return (
    <main className="relative z-10 mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <SiteHeader />
      <div className="mx-auto max-w-[720px]">
        <Breadcrumbs trail={trail} />

        <h1 className="font-display text-[clamp(1.6rem,5vw,2.1rem)] font-medium leading-tight tracking-tight text-[var(--ink)]">
          Is {hub.country} safe? {hub.flag}
        </h1>
        <p className="mt-1 text-[0.8rem] text-[var(--ink-faint)]">
          {hub.region} · Updated <time dateTime={hub.updatedAt}>{humanDate(hub.updatedAt)}</time>
        </p>
        <p className="mt-4 text-[1rem] leading-relaxed text-[var(--ink)]">{capsule}</p>

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

        {/* Official advisories, always shown at country level */}
        {!countryReport && advisories.length > 0 && (
          <section className="mt-8">
            <h2 className="font-display text-[1.35rem] font-medium tracking-tight text-[var(--ink)]">
              What government advisories say about {hub.country}
            </h2>
            <div className="mt-3 space-y-3">
              {advisories.map((a) => (
                <div key={a.source} className="card px-4 py-3.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-[var(--ink-faint)]">
                      {a.source}
                    </p>
                    {a.level != null && (
                      <span className="tnum text-[0.72rem] font-bold text-[var(--ink)]">Level {a.level}</span>
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
                </div>
              ))}
            </div>
          </section>
        )}

        {/* City reports — every city page gets its hub inlink here */}
        {hub.cities.length > 0 && (
          <section className="mt-8">
            <h2 className="font-display text-[1.35rem] font-medium tracking-tight text-[var(--ink)]">
              {hub.country} destinations by safety score
            </h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {hub.cities.map((m) => (
                <ReportLink key={m.path} meta={m} anchor={`Is ${m.city} safe?`} />
              ))}
            </div>
          </section>
        )}

        {/* Country-level data table */}
        {!countryReport && signals.length > 0 && (
          <section className="mt-10">
            <h2 className="font-display text-[1.35rem] font-medium tracking-tight text-[var(--ink)]">
              {hub.country} safety data
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
                  {signals.map((s) => (
                    <tr key={s.key} className="border-b border-[var(--hairline)]">
                      <td className="py-2 pr-3 font-medium text-[var(--ink)]">{s.label}</td>
                      <td className="tnum py-2 pr-3 text-[var(--ink-soft)]">{s.display}</td>
                      <td className="tnum py-2 pr-3 font-semibold" style={{ color: scoreColor(s.score as number) }}>
                        {s.score}/100
                      </td>
                      <td className="py-2 text-[0.78rem] text-[var(--ink-faint)]">
                        {sourceUrlForName(s.source) ? (
                          <a href={sourceUrlForName(s.source) as string} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--accent)] hover:underline">
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

        <FaqSection
          title={`${hub.country} safety FAQ`}
          items={[
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
          ].filter((i) => i.q)}
        />

        <RegionLinks currentSlug={hub.countrySlug} region={hub.region} />

        <SeoFooter updatedAt={hub.updatedAt} />
      </div>
    </main>
  )
}

async function RegionLinks({ currentSlug, region }: { currentSlug: string; region: string }) {
  const all = (await listCountries()).filter((c) => c.countrySlug !== currentSlug)
  const sameRegion = all.filter((c) => c.region === region).slice(0, 6)
  const items = sameRegion.length ? sameRegion : all.slice(0, 6)
  if (!items.length) return null
  return (
    <section className="mt-10">
      <h2 className="font-display text-[1.2rem] font-medium tracking-tight text-[var(--ink)]">
        {sameRegion.length ? `More of ${region}` : "Other countries"}
      </h2>
      <div className="mt-3 flex flex-wrap gap-2">
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
