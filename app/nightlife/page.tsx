import type { Metadata } from "next"
import Link from "next/link"
import { SiteHeader } from "@/components/SiteHeader"
import { SiteFooter } from "@/components/SiteFooter"
import { NightlifeDirectory, type DirectoryCity } from "@/components/nightlife/Directory"
import { RequestCity } from "@/components/nightlife/RequestCity"
import { NightGlobe } from "@/components/nightlife/NightGlobe"
import { listReports } from "@/lib/reports"
import { listNightlife, nightlifePath, nightlifeUrl, NIGHTLIFE_INDEXABLE } from "@/lib/nightlife/store"
import { getNightlifeGlobePayload } from "@/lib/nightlife/globe"
import { humanDate } from "@/lib/site"
import { Breadcrumbs } from "@/components/seo/shared"
import "@/components/nightlife/nightlife.css"
import "@/components/nightlife/directory.css"
import "@/components/nightlife/night-globe.css"

export const revalidate = 60

export async function generateMetadata(): Promise<Metadata> {
  const reports = await listNightlife()
  const venues = reports.reduce((sum, report) => sum + report.venueCount, 0)
  return {
    title: "Nightlife Reports: Bars, Clubs & After-Dark Safety by City",
    description: `Explore ${reports.length} researched city nightlife guides covering ${venues.toLocaleString("en")} mapped bars, clubs and live-music venues, with opening hours, neighbourhoods and after-dark safety.`,
    robots: { index: NIGHTLIFE_INDEXABLE, follow: NIGHTLIFE_INDEXABLE },
    alternates: { canonical: nightlifeUrl("/nightlife") },
    openGraph: { title: "Nightlife, city by city", description: `Bars, clubs, late-night venues and after-dark safety across ${reports.length} researched city guides.`, url: nightlifeUrl("/nightlife"), type: "website" },
  }
}

export default async function NightlifeIndex() {
  const [safetyReports, nightlife, globe] = await Promise.all([listReports(), listNightlife(), getNightlifeGlobePayload()])
  const reportsByPath = new Map(nightlife.map(report => [nightlifePath(report), report]))
  const cities = new Map<string, DirectoryCity>()
  for (const city of safetyReports.filter(city => city.path.split("/").filter(Boolean).length === 2)) {
    const path = `${city.path}/nightlife`, report = reportsByPath.get(path)
    cities.set(path, {
      key: city.key, city: city.city, country: city.country, region: city.region, path,
      report: report && report.overall != null ? { overall: report.overall, venueCount: report.venueCount, limited: report.outcome === "limited" } : null,
    })
  }
  // Keep already-published guides reachable if a safety cache entry is moved.
  for (const report of nightlife) {
    const path = nightlifePath(report)
    if (!cities.has(path) && report.overall != null) cities.set(path, {
      key: report.city.key, city: report.city.city, country: report.city.country, region: "", path,
      report: { overall: report.overall, venueCount: report.venueCount, limited: report.outcome === "limited" },
    })
  }

  const guides = [...nightlife].sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0) || a.city.city.localeCompare(b.city.city, "en"))
  // One array, one serialisation. Built twice, the RSC payload carried the
  // 1,300-city list once per client component that received it.
  const cityList = [...cities.values()]
  const trail = [{ name: "Home", href: "/" }, { name: "Nightlife", href: "/nightlife" }]
  // Nightlife is canonical on the beta origin, so its schema must use the same
  // origin rather than borrowing production's website node.
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", name: "IsMyTripSafe", url: nightlifeUrl("/") },
      { "@type": "WebSite", name: "IsMyTripSafe Nightlife", url: nightlifeUrl("/"), publisher: { "@type": "Organization", name: "IsMyTripSafe" } },
      {
        "@type": "CollectionPage",
        name: "City nightlife reports",
        url: nightlifeUrl("/nightlife"),
        isPartOf: { "@type": "WebSite", url: nightlifeUrl("/") },
        ...(globe.updatedAt ? { dateModified: globe.updatedAt } : {}),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: nightlifeUrl("/") },
          { "@type": "ListItem", position: 2, name: "Nightlife", item: nightlifeUrl("/nightlife") },
        ],
      },
    ],
  })

  return <div className="nl-page nlg-page">
    <SiteHeader />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />

    <header className="nlg-masthead">
      <Breadcrumbs trail={trail} />
      <div className="nlg-masthead-grid">
        <div>
          <p className="postcard-greeting">After dark</p>
          <h1>Every night out we&apos;ve mapped, <em>on one globe.</em></h1>
          <p className="nlg-masthead-lede">
            {globe.totals.reports} researched city guides, {globe.totals.venues.toLocaleString("en")} mapped bars, clubs and live-music venues.
            Spin the planet, follow the lights, and open a city for opening hours, neighbourhoods and after-dark safety.
          </p>
          <p className="nlg-masthead-note">Drag to spin · scroll to zoom · click a country or a city light · <Link href="/nightlife/testimonials" prefetch={false}>search traveler quotes →</Link> · <a href="#nlg-request">ask for a city →</a></p>
        </div>
        <dl className="nlg-stats">
          {[
            { n: globe.totals.reports, l: "guides" },
            { n: globe.totals.countries, l: "countries" },
            { n: globe.totals.venues, l: "venues" },
          ].map(stat => <div key={stat.l}><dt>{stat.l}</dt><dd>{stat.n.toLocaleString("en")}</dd></div>)}
        </dl>
      </div>
    </header>

    <NightGlobe payload={globe} />
    <div className="night-horizon" aria-hidden />

    <main>
      <section className="nlg-directory-section" aria-labelledby="nightlife-directory-title">
        <div className="nlg-directory-head">
          <div>
            <p className="postcard-greeting">The index</p>
            <h2 id="nightlife-directory-title">Explore every city guide</h2>
          </div>
          <p>Published guides lead the list. Open any city to see its venues, late-night hours and safety after dark.</p>
        </div>
        <RequestCity cities={cityList} />
        {/* Same collapsed disclosure pattern as /destinations: the globe is
            the invitation, the full 1,000-city index is a deliberate choice. */}
        <details className="disclosure nlg-disclosure">
          <summary>Every city and nightlife guide as a plain list <span>{guides.length} published · {cities.size} cities · open ▾</span></summary>
          <div className="disclosure-body">
            <NightlifeDirectory cities={cityList} />
            <div className="nlg-all-guides">
              <h3>Every published guide <span>{guides.length} cities · updated {humanDate(globe.updatedAt)}</span></h3>
              <ul>{guides.map(report => <li key={report.city.key}>
                <Link href={nightlifePath(report)} prefetch={false}>
                  <strong>{report.city.city}</strong><span>{report.city.country}</span>
                  <em>{report.overall?.toFixed(1) ?? "–"}/5 · {report.venueCount.toLocaleString("en")} venues</em>
                </Link>
              </li>)}</ul>
            </div>
          </div>
        </details>
      </section>

      <div className="nlg-footer">
        <p>Don&apos;t see your city yet? <a href="#nlg-request">Ask for a guide</a> — requests go to the front of the research queue.</p>
        <SiteFooter />
      </div>
    </main>
  </div>
}
