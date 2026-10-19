"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { ArrowUpRight, Search, X } from "lucide-react"
import { Stars } from "./Stars"

export interface DirectoryCity {
  key: string
  city: string
  country: string
  region: string
  path: string
  report: { overall: number; venueCount: number; limited: boolean } | null
}

const STARTERS = [
  "/georgia/tbilisi/nightlife", "/portugal/porto/nightlife",
  "/poland/gdansk/nightlife", "/serbia/belgrade/nightlife",
  "/hungary/budapest/nightlife", "/albania/shkoder/nightlife",
  "/slovenia/ljubljana/nightlife", "/laos/luang-prabang/nightlife",
  "/germany/berlin/nightlife", "/portugal/lisbon/nightlife",
  "/japan/tokyo/nightlife", "/mexico/mexico-city/nightlife",
]
const normalized = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()

export function NightlifeDirectory({ cities }: { cities: DirectoryCity[] }) {
  const [query, setQuery] = useState("")
  const [region, setRegion] = useState("")
  const [publishedOnly, setPublishedOnly] = useState(false)
  const [limit, setLimit] = useState(18)
  const publishedCount = cities.filter(city => city.report).length
  const regions = [...new Set(cities.map(city => city.region).filter(Boolean))].sort((a, b) => a.localeCompare(b, "en"))
  const filtered = useMemo(() => {
    const terms = normalized(query).split(/[\s,]+/).filter(Boolean)
    return cities.filter(city => (!region || city.region === region)
      && (!publishedOnly || city.report)
      && terms.every(term => normalized(`${city.city} ${city.country}`).includes(term)))
      .sort((a, b) => {
        if (terms.length) {
          const aStarts = normalized(a.city).startsWith(terms[0]) ? 0 : 1
          const bStarts = normalized(b.city).startsWith(terms[0]) ? 0 : 1
          if (aStarts !== bStarts) return aStarts - bStarts
        }
        if (!!a.report !== !!b.report) return a.report ? -1 : 1
        if (!terms.length && !region && !publishedOnly) {
          const aRank = STARTERS.indexOf(a.path), bRank = STARTERS.indexOf(b.path)
          if (aRank !== bRank) return (aRank < 0 ? 999 : aRank) - (bRank < 0 ? 999 : bRank)
        }
        return a.city.localeCompare(b.city, "en") || a.country.localeCompare(b.country, "en")
      })
  }, [cities, query, region, publishedOnly])
  const reset = () => { setQuery(""); setRegion(""); setPublishedOnly(false); setLimit(18) }

  return <section className="nld-directory" aria-labelledby="nightlife-cities-title">
    <div className="nld-controls">
      <div className="nld-search-group" role="search">
        <label htmlFor="nightlife-city-search">Find a city</label>
        <div className="nld-search">
          <Search size={18} strokeWidth={1.7} aria-hidden="true"/>
          <input id="nightlife-city-search" type="search" placeholder="City or country" autoComplete="off" value={query}
            onChange={event => { setQuery(event.target.value); setLimit(18) }}/>
          {query && <button type="button" onClick={() => { setQuery(""); setLimit(18) }} aria-label="Clear city search"><X size={16}/></button>}
        </div>
      </div>
      <div className="nld-region">
        <label htmlFor="nightlife-region">Region</label>
        <select id="nightlife-region" value={region} onChange={event => { setRegion(event.target.value); setLimit(18) }}>
          <option value="">Everywhere</option>
          {regions.map(value => <option key={value} value={value}>{value}</option>)}
        </select>
      </div>
    </div>

    <div className="nld-list-heading">
      <h2 id="nightlife-cities-title">{query || region ? "Matching cities" : publishedOnly ? "Published reports" : "Explore a city"}</h2>
      <p role="status">{filtered.length.toLocaleString("en")} {filtered.length === 1 ? "city" : "cities"}</p>
    </div>
    {publishedCount > 0 && <div className="nld-tabs" role="group" aria-label="Report availability">
      <button type="button" aria-pressed={!publishedOnly} onClick={() => { setPublishedOnly(false); setLimit(18) }}>All cities</button>
      <button type="button" aria-pressed={publishedOnly} onClick={() => { setPublishedOnly(true); setLimit(18) }}>Ready to read <span>{publishedCount}</span></button>
    </div>}

    {filtered.length ? <ul className="nld-city-list">{filtered.slice(0, limit).map(city => <li key={city.key}>
      <Link href={city.path} prefetch={false} className="nld-city">
        <div className="nld-city-name"><h3>{city.city}</h3><span>{city.country}</span></div>
        <div className="nld-city-report">{city.report ? <><div><Stars value={city.report.overall}/><strong>{city.report.overall.toFixed(1)}</strong></div><span>{city.report.venueCount} venues{city.report.limited ? " · Limited data" : ""}</span></> : <span className="nld-open-label">Explore nightlife</span>}</div>
        <ArrowUpRight size={18} strokeWidth={1.4} aria-hidden="true"/>
      </Link>
    </li>)}</ul> : <div className="nld-no-results"><h3>{cities.length ? "No cities found." : "No cities available yet."}</h3><p>{cities.length ? "Try a different spelling or the country name." : "Start with a destination’s safety report."}</p>{cities.length > 0 && <button type="button" onClick={reset}>Clear the filters</button>}<Link href="/destinations">Browse all destinations ↗</Link></div>}

    {filtered.length > limit && <button type="button" className="nld-more" onClick={() => setLimit(value => value + 24)}>Show more cities <span>↓</span></button>}
    <div className="nld-fine-print"><p>Opening a city starts its nightlife research if needed. The first report can take a few minutes; saved reports load straight away.</p><p>Ratings cover density, quality, variety, vibe and safety. Every report includes its sources and any gaps in the data.</p></div>
  </section>
}
