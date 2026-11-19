"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { ArrowUpRight, Search, X } from "lucide-react"
import type { TestimonialEntry } from "@/lib/nightlife/store"
import { plainCopy } from "@/lib/nightlife/presentation"

const normalized = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
const dateLabel = (value: string | null) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" }) : "Undated"

export function TestimonialSearch({ entries }: { entries: TestimonialEntry[] }) {
  const [query, setQuery] = useState("")
  const [city, setCity] = useState("")
  const [sentiment, setSentiment] = useState<"all" | "positive" | "mixed" | "negative">("all")
  const [limit, setLimit] = useState(24)
  const cities = useMemo(() => [...new Set(entries.map(entry => entry.city))].sort((a, b) => a.localeCompare(b, "en")), [entries])
  const filtered = useMemo(() => {
    const terms = normalized(query).split(/\s+/).filter(Boolean)
    return entries.filter(entry => (!city || entry.city === city)
      && (sentiment === "all" || entry.sentiment === sentiment)
      && terms.every(term => normalized(`${entry.quote} ${entry.city} ${entry.country} ${entry.source}`).includes(term)))
  }, [entries, query, city, sentiment])
  const reset = () => { setQuery(""); setCity(""); setSentiment("all"); setLimit(24) }
  return <section className="nlt-search" aria-labelledby="testimonial-search-title">
    <h2 id="testimonial-search-title" className="sr-only">Search traveler testimonials</h2>
    <div className="nlt-controls">
      <div className="nlt-query" role="search">
        <label htmlFor="testimonial-query">Search quotes</label>
        <div className="nlt-query-field">
          <Search size={17} aria-hidden />
          <input id="testimonial-query" type="search" placeholder="Nightlife, jazz, rooftop, a city…" value={query}
            onChange={event => { setQuery(event.target.value); setLimit(24) }} autoComplete="off" />
          {query && <button type="button" onClick={() => { setQuery(""); setLimit(24) }} aria-label="Clear quote search"><X size={15} /></button>}
        </div>
      </div>
      <div className="nlt-city">
        <label htmlFor="testimonial-city">City</label>
        <select id="testimonial-city" value={city} onChange={event => { setCity(event.target.value); setLimit(24) }}>
          <option value="">Every city</option>
          {cities.map(value => <option key={value} value={value}>{value}</option>)}
        </select>
      </div>
    </div>
    <div className="nlt-tabs" role="group" aria-label="Filter by tone">
      {(["all", "positive", "mixed", "negative"] as const).map(value => <button key={value} type="button" aria-pressed={sentiment === value}
        onClick={() => { setSentiment(value); setLimit(24) }}>{value === "all" ? "All tones" : value === "negative" ? "Critical" : value[0].toUpperCase() + value.slice(1)}</button>)}
      <span className="nlt-count" role="status">{filtered.length.toLocaleString("en")} {filtered.length === 1 ? "quote" : "quotes"}</span>
    </div>
    {filtered.length ? <div className="nlt-grid">{filtered.slice(0, limit).map(entry => <figure key={entry.id} className={`nlt-card nlt-${entry.sentiment}`}>
      <blockquote>{plainCopy(entry.quote)}</blockquote>
      <figcaption>
        <Link prefetch={false} href={entry.path}>{entry.city}<span>{entry.country}</span></Link>
        <div><a href={entry.url} target="_blank" rel="noopener noreferrer">{entry.source} <ArrowUpRight size={11}/></a><small>{entry.kind === "travel guide" ? "Travel guide" : entry.kind === "search snippet" ? "Search result" : "Article"} · {dateLabel(entry.publishedAt)}</small></div>
      </figcaption>
    </figure>)}</div> : <div className="nlt-empty"><h3>No quotes match.</h3><p>Try a different word, city or tone.</p><button type="button" onClick={reset}>Clear the filters</button></div>}
    {filtered.length > limit && <button type="button" className="nlt-more" onClick={() => setLimit(value => value + 24)}>Show more quotes <span>↓</span></button>}
  </section>
}
