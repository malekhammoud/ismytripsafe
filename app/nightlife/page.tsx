import type { Metadata } from "next"
import Link from "next/link"
import { SiteHeader } from "@/components/SiteHeader"
import { SiteFooter } from "@/components/SiteFooter"
import { NightlifeDirectory, type DirectoryCity } from "@/components/nightlife/Directory"
import { listReports } from "@/lib/reports"
import { listNightlife, nightlifePath, nightlifeUrl, NIGHTLIFE_INDEXABLE } from "@/lib/nightlife/store"
import "@/components/nightlife/nightlife.css"
import "@/components/nightlife/directory.css"

export const dynamic = "force-dynamic"
export const metadata: Metadata = {
  title: "City Nightlife Reports: Bars, Clubs & After-Dark Safety",
  description: "Find city nightlife guides with venue maps, ratings, traveler accounts and safety after dark. Reports are researched when you open a city.",
  robots: { index: NIGHTLIFE_INDEXABLE, follow: NIGHTLIFE_INDEXABLE },
  alternates: { canonical: nightlifeUrl("/nightlife") },
}

export default async function NightlifeIndex() {
  const [safetyReports, nightlife] = await Promise.all([listReports(), listNightlife()])
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
  return <div className="nl-page nld-page">
    <SiteHeader/>
    <main className="nld-main">
      <header className="nld-intro">
        <Link href="/" className="nld-back">← IsMyTripSafe</Link>
        <div className="nld-intro-grid">
          <div><h1>Nightlife, city by city.</h1><p className="nld-description">Bars, clubs, live music.<br/>And a clearer picture of safety after dark.</p></div>
          <aside className="nld-intro-note"><Link href="/destinations">City safety reports ↗</Link></aside>
        </div>
      </header>
      <NightlifeDirectory cities={[...cities.values()]}/>
      <SiteFooter/>
    </main>
  </div>
}
