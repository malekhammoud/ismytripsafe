import type { Metadata } from "next"
import Link from "next/link"
import { getGlobePayload } from "@/lib/globe-data"
import { absUrl, humanDate } from "@/lib/site"
import { breadcrumbNode, graph, organizationNode, websiteNode } from "@/lib/seo/jsonld"
import { Breadcrumbs, SectionHeading, SeoFooter, SiteHeader } from "@/components/seo/shared"
import { GlobeExplorer } from "@/components/globe/GlobeExplorer"

export const dynamic = "force-dynamic"

export async function generateMetadata(): Promise<Metadata> {
  const year = new Date().getFullYear()
  return {
    title: `The Safety Globe ${year} — Every Destination, Scored`,
    description:
      `Spin the globe and open any country. ${year} travel safety scores for every destination we've ` +
      "researched, built from official advisories, crime and governance data, live environmental feeds " +
      "and AI field research.",
    alternates: { canonical: "/destinations" },
  }
}

export default async function DestinationsPage() {
  const payload = await getGlobePayload()
  const { totals, updatedAt } = payload

  // Country slug → its city reports, best first. Feeds the crawlable index
  // at the foot of the page (the globe holds the same data client-side).
  const cityIndex = new Map<string, typeof payload.points>()
  for (const p of payload.points) {
    const arr = cityIndex.get(p.countrySlug)
    if (arr) arr.push(p)
    else cityIndex.set(p.countrySlug, [p])
  }
  for (const arr of cityIndex.values()) arr.sort((a, b) => b.score - a.score)

  const trail = [
    { name: "Home", href: "/" },
    { name: "Destinations", href: "/destinations" },
  ]

  const jsonLd = graph(organizationNode(), websiteNode(), breadcrumbNode(trail), {
    "@type": "CollectionPage",
    name: "All destination safety reports",
    url: absUrl("/destinations"),
    isPartOf: { "@id": `${absUrl("/")}#website` },
    ...(updatedAt ? { dateModified: updatedAt } : {}),
  })

  return (
    <>
      <SiteHeader />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />

      {/* ── Masthead ── */}
      <div className="relative z-10 mx-auto max-w-6xl px-4 pb-6 pt-7 sm:px-6">
        <Breadcrumbs trail={trail} />
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div className="max-w-[38rem]">
            <p className="postcard-greeting">Wish you were here</p>
            <h1 className="font-display mt-1 text-[clamp(1.9rem,5.2vw,2.9rem)] font-medium leading-[1.04] tracking-tight text-[var(--navy)]">
              Every destination we&apos;ve checked, on one globe
            </h1>
            <p className="mt-3.5 text-[0.95rem] leading-relaxed text-[var(--ink-soft)]">
              {totals.reports} independent safety reports across {totals.countries} countries. Drag to
              spin it, scroll to come in closer, and click any country to open what we found there.
            </p>
          </div>
          <dl className="flex gap-7">
            {[
              { n: totals.reports, l: "reports" },
              { n: totals.countries, l: "countries" },
              { n: totals.cities, l: "cities" },
            ].map((s) => (
              <div key={s.l}>
                <dt className="sr-only">{s.l}</dt>
                <dd className="font-display tnum text-[1.9rem] font-medium leading-none text-[var(--accent-deep)]">
                  {s.n}
                </dd>
                <p className="label mt-1">{s.l}</p>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* ── The globe ── */}
      <div className="relative z-10">
        <GlobeExplorer payload={payload} />
        <div className="shoreline relative z-10 -mt-2" aria-hidden />
      </div>

      <main className="relative z-10 mx-auto max-w-6xl px-4 pb-2 sm:px-6">
        {/* No postcard decks here. This page is the globe and the index — the
            globe already shows every destination and its score, and eighteen
            cards under it were a second, worse version of the same answer.
            The cards live on the home page, where they are the invitation. */}

        {/* ── The full index ──
            The globe is WebGL and client-only, so on its own it would strip
            every internal link off this page and leave anyone without a GPU
            with nothing. This stays: server-rendered, complete, collapsed. */}
        <section className="mt-16">
          <SectionHeading note={`${payload.countries.length} countries`}>
            The full index
          </SectionHeading>
          {/* prefetch={false} throughout: this index is ~1,000 links. Letting
              Next prefetch them floods the router with requests the browser
              then aborts, which poisons its cache and leaves navigation
              hanging on entries that never resolve. */}
          <details className="disclosure mt-3.5">
            <summary>
              Every country and city as a plain list
              <span className="text-[0.72rem] font-normal text-[var(--ink-faint)]">
                open ▾
              </span>
            </summary>
            <div className="disclosure-body">
              <ul className="columns-1 gap-x-8 sm:columns-2 lg:columns-3">
                {[...payload.countries]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((c) => (
                    <li key={c.slug} className="mb-3 break-inside-avoid">
                      <Link
                        href={`/${c.slug}`}
                        prefetch={false}
                        className="font-semibold text-[var(--navy)] hover:text-[var(--accent-deep)] hover:underline"
                      >
                        {c.flag} {c.name}
                      </Link>
                      <span className="tnum ml-1.5 text-[0.7rem] text-[var(--ink-faint)]">{c.score}</span>
                      {(cityIndex.get(c.slug) ?? []).length > 0 && (
                        <span className="mt-0.5 block text-[0.76rem] leading-relaxed text-[var(--ink-soft)]">
                          {(cityIndex.get(c.slug) ?? []).map((p, i) => (
                            <span key={p.path}>
                              {i > 0 && " · "}
                              <Link
                                href={p.path}
                                prefetch={false}
                                className="hover:text-[var(--accent-deep)] hover:underline"
                              >
                                {p.city}
                              </Link>
                            </span>
                          ))}
                        </span>
                      )}
                    </li>
                  ))}
              </ul>
            </div>
          </details>
        </section>

        <div className="mx-auto mt-14 max-w-[760px]">
          <div className="deckle" aria-hidden />
          <p className="mt-6 text-center text-[0.9rem] leading-relaxed text-[var(--ink-soft)]">
            Don&apos;t see your destination on the globe?{" "}
            <Link href="/" className="font-semibold text-[var(--accent-deep)] hover:underline">
              Generate its report in about a minute
            </Link>
            {updatedAt && <> · last refresh {humanDate(updatedAt)}</>}
          </p>
          <SeoFooter updatedAt={updatedAt} />
        </div>
      </main>
    </>
  )
}
