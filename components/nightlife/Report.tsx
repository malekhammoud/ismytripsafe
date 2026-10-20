import Link from "next/link"
import { ArrowUpRight, AudioLines, Beer, ChevronRight, Clock3, MapPin, Moon, ShieldCheck, Sparkles } from "lucide-react"
import { SiteHeader } from "@/components/SiteHeader"
import { SiteFooter } from "@/components/SiteFooter"
import { Stars } from "./Stars"
import { VenueMap } from "./VenueMap"
import { SafetyMap } from "./SafetyMap"
import { nightlifePath, type NightlifeSummary } from "@/lib/nightlife/store"
import { distance } from "@/lib/nightlife/venues"
import { VENUE_TYPES, type NightlifeReport, type ScoreKey, type SourceId } from "@/lib/nightlife/types"
import "./nightlife.css"
const ICONS = { density: MapPin, quality: Sparkles, variety: AudioLines, vibe: Moon, safety: ShieldCheck }
const DESCRIPTIONS: Record<ScoreKey, string> = { density: "How much there is", quality: "How good the venues are", variety: "How much choice you have", vibe: "How travelers felt", safety: "How safe a night out feels" }
export function dateLabel(date: string | null | undefined) { return date && Number.isFinite(Date.parse(date)) ? new Date(date).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" }) : "Date unavailable" }
function sourceLinks(report: NightlifeReport, ids: SourceId[]) {
  return <span className="nl-source">{report.sources.filter(s => ids.includes(s.id) && s.fetchedAt).map((s, i) => <span key={s.id}>{i ? " · " : ""}<a href={s.url} target="_blank" rel="noopener noreferrer">{s.name} ↗</a> · {dateLabel(s.fetchedAt)}{s.status === "error" ? " (refresh failed)" : ""}</span>)}</span>
}
function SectionTitle({ n, eyebrow, title, children }: { n: string; eyebrow: string; title: string; children?: React.ReactNode }) {
  return <div className="nl-section-heading"><span className="nl-section-number">{n}</span><div><p className="nl-eyebrow">{eyebrow}</p><h2>{title}</h2>{children}</div></div>
}
function activeEvents(r: NightlifeReport) { return r.events.filter(e => Date.parse(e.date.slice(0, 10) + "T23:59:59Z") >= Date.now()) }
export function NightlifeReportPage({ report: r, nearby }: { report: NightlifeReport; nearby: NightlifeSummary[] }) {
  const c = r.city, available = r.scores.filter(s => s.value != null).length
  const counts = VENUE_TYPES.map(type => ({ type, count: r.venues.filter(v => v.type === type).length })).filter(t => t.count > 0).sort((a, b) => b.count - a.count)
  const ranked = r.venues.filter(v => v.rating != null && v.votes != null && v.votes > 0).sort((a, b) => b.rating! - a.rating!).slice(0, 10)
  const events = activeEvents(r)
  const eventsConnected = r.sources.some(s => s.id === "ticketmaster" && s.fetchedAt)
  const vibe = r.scores.find(s => s.key === "vibe")!
  const mentions = r.mentions.filter(m => m.relevant && Date.parse(m.publishedAt) <= Date.now() && Date.parse(m.publishedAt) >= Date.now() - 3 * 365.25 * 86400000)
  const themeCounts = new Map<string, typeof mentions>()
  for (const m of mentions) for (const theme of m.themes) themeCounts.set(theme, [...(themeCounts.get(theme) ?? []), m])
  const themes = [...themeCounts].sort((a, b) => b[1].length - a[1].length).slice(0, 4)
  const beerAmount = (value: number | null, usd: number | null) => value == null ? "Not available" : `${new Intl.NumberFormat("en", { style: "currency", currency: r.beer!.currency, maximumFractionDigits: 2 }).format(value)}${usd != null && r.beer!.currency !== "USD" ? ` · US$${usd.toFixed(2)}` : ""}`
  const stale = Date.now() - Date.parse(r.refresh.venues || r.updatedAt) > 35 * 86400000
  return <div className="nl-page">
    <SiteHeader />
    <main>
      <header className="nl-hero">
        <div className="nl-container">
          <nav aria-label="Breadcrumb" className="nl-breadcrumb"><Link href="/">Home</Link><ChevronRight size={12}/><Link href="/nightlife">After dark</Link><ChevronRight size={12}/><span>{c.city}</span></nav>
          <div className="nl-hero-grid"><div>
            <p className="nl-eyebrow nl-lime"><Moon size={13}/> THE AFTER-DARK EDITION</p>
            <h1>{c.city}<br/><em>after dark.</em></h1>
            <p className="nl-hero-deck">{c.city} Nightlife {new Date(r.updatedAt).getUTCFullYear()}: Bars, Clubs &amp; Safety</p>
            <div className="nl-hero-chips"><span><MapPin size={12}/>{c.country}</span><span>Independent city report</span>{r.outcome === "limited" && <span className="nl-limited">Limited data</span>}</div>
          </div><div className="nl-rating-ticket">
            <p className="nl-eyebrow">THE NIGHTLIFE RATING</p>
            <div className="nl-overall">{r.overall?.toFixed(1)}<span>/ 5</span></div>
            <Stars value={r.overall} large/>
            <p>{r.outcome === "full" ? "Average of all five ratings." : `${available} of 5 ratings available.`}</p>
            <a href="#the-stars">See what’s behind the stars <ArrowUpRight size={14}/></a>
          </div></div>
          <p className="nl-data-line">Based on <strong>{r.venues.length.toLocaleString()} mapped venues</strong>, {eventsConnected ? `${events.length} upcoming events` : "event data unavailable"} and {mentions.length} traveler mentions · Updated <time dateTime={r.updatedAt}>{dateLabel(r.updatedAt)}</time></p>
        </div>
      </header>
      <div className="nl-container nl-body">
        <nav className="nl-jump" aria-label="Report sections"><a href="#the-stars">The verdict</a><a href="#venues">The scene</a><a href="#hotspots">The map</a><a href="#late">After midnight</a><a href="#travelers">The word</a><a href="#night-safety">Stay safe</a></nav>
        {r.outcome === "limited" && <aside className="nl-data-notice"><span className="nl-dot"/><div><strong>A useful picture, with a few gaps.</strong><p>This is a limited-data report. The overall rating averages {available} available subscores; missing scores are excluded. {r.scores.filter(s => s.value == null).map(s => s.label).join(" and ")} need more evidence.</p></div><a href="#sources">Check our sources ↗</a></aside>}
        {stale && <p className="nl-data-notice">Venue data is older than our monthly refresh target. Check current listings before making plans.</p>}
        <section id="the-stars" className="nl-section">
          <SectionTitle n="01" eyebrow="YOUR NIGHT, AT A GLANCE" title="The five ratings"/>
          <div className="nl-score-grid">{r.scores.map(score => { const Icon = ICONS[score.key]; return <article key={score.key} className={`nl-score ${score.value == null ? "nl-score-missing" : ""}`}><div className="nl-score-top"><Icon size={19}/><span>{score.value == null ? "—" : score.value.toFixed(1)}<small>/5</small></span></div><h3>{score.label}</h3><p className="nl-score-question">{DESCRIPTIONS[score.key]}</p><Stars value={score.value}/><ul>{score.bullets.slice(0, 2).map(b => <li key={b}>{b}</li>)}</ul><a className="nl-score-link" href={`#method-${score.key}`}>How this is calculated ↗</a></article> })}</div>
          <p className="nl-footnote">Subscore icons round to half stars. Numbers retain their precision; the overall is the unweighted mean of available subscores, shown to one decimal.</p>
        </section>
        <section id="venues" className="nl-section">
          <SectionTitle n="02" eyebrow="THE SHAPE OF THE SCENE" title="Bars, clubs and live music"><p>From a quiet first drink to the last song. Here’s what’s mapped.</p></SectionTitle>
          <div className="nl-scene-grid"><div className="nl-venue-total"><Beer size={30}/><strong>{r.venues.length.toLocaleString()}</strong><h3>places to start the evening</h3><p>Mapped inside the city boundary. A lower bound, never a complete census.</p>{sourceLinks(r, ["osm", "foursquare"])}</div><div className="nl-breakdown">{counts.map(({ type, count }) => <div key={type} className="nl-bar-row"><div><span>{type}</span><strong>{count}</strong></div><div className="nl-bar-track"><span style={{ width: `${count / r.venues.length * 100}%` }}/></div></div>)}</div></div>
        </section>
        <section id="hotspots" className="nl-section"><SectionTitle n="03" eyebrow="GET YOUR BEARINGS" title="Where venues cluster"><p>Each dot is a sourced venue. Denser groups show where venues cluster; they don’t imply a safety rating.</p></SectionTitle><VenueMap venues={r.venues} city={c.city} lat={c.lat} lon={c.lon}/>{sourceLinks(r, ["osm", "foursquare"])}</section>
        <section className="nl-section" id="top-venues"><SectionTitle n="04" eyebrow="ON THE SHORTLIST" title="Top-rated venues"><p>Highest available venue ratings, shown separately from the popularity-based Quality score.</p></SectionTitle>
          {ranked.length ? <div className="nl-table-wrap"><table className="nl-table"><caption className="sr-only">Top rated venues in {c.city}</caption><thead><tr><th>Venue</th><th>Kind of night</th><th>Neighborhood</th><th>Foursquare rating</th></tr></thead><tbody>{ranked.map(v => <tr key={v.id}><td><a href={v.sources.find(s => s.id === "foursquare")?.url ?? v.sources[0].url} target="_blank" rel="noopener noreferrer">{v.name} ↗</a></td><td>{v.type}</td><td>{v.neighborhood ?? "Not listed"}</td><td><strong>{v.rating!.toFixed(1)}</strong>/10 <small>({v.votes} votes)</small></td></tr>)}</tbody></table></div> : <div className="nl-empty"><Sparkles size={23}/><h3>No supported venue ratings yet.</h3><p>Browse the mapped venues above. We’ll add a shortlist when ratings and review counts are available.</p></div>}{sourceLinks(r, ["foursquare"])}</section>
        <section id="late" className="nl-section"><SectionTitle n="05" eyebrow="ONE MORE, OR CALL IT A NIGHT?" title="After midnight."><p>Opening hours are useful context. They never change the stars.</p></SectionTitle>
          <div className="nl-late-grid">{[["00:00", "Past midnight", r.lateness.afterMidnight], ["02:00", "Past 2 am", r.lateness.after2], ["04:00", "Past 4 am", r.lateness.after4]].map(([time, label, count]) => <div className="nl-late-card" key={time}><Clock3 size={18}/><span className="nl-clock">{time}</span><h3>{label}</h3><strong>{r.lateness.known ? `${Math.round(Number(count) / r.lateness.known * 100)}%` : "—"}</strong><p>{r.lateness.known ? `${count} of ${r.lateness.known} venues with known hours` : "Not enough verified opening hours"}</p></div>)}</div>
          <p className="nl-footnote">{r.lateness.known} of {r.venues.length} venues have interpretable opening hours. {r.lateness.note}</p>{sourceLinks(r, ["osm"])}</section>
        <div className="nl-two-col">
          <section className="nl-section" id="events"><SectionTitle n="06" eyebrow="COMING UP" title="Upcoming events"/>
            {events.length ? <ul className="nl-events">{events.slice(0, 8).map(e => <li key={e.id}><time dateTime={e.date}>{new Date(e.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}</time><div><a href={e.url} target="_blank" rel="noopener noreferrer">{e.name} ↗</a><p>{e.venue}</p></div></li>)}</ul> : <div className="nl-empty"><AudioLines size={23}/><h3>{eventsConnected ? "No upcoming listings in our stored results." : "Event listings unavailable"}</h3><p>{eventsConnected ? "Ticketmaster’s coverage varies by city. No listings doesn’t mean no live music." : "Event listings aren’t available for this city yet."}</p></div>}{sourceLinks(r, ["ticketmaster"])}<p className="nl-footnote">Music events within 15 km · next 45 days at collection · refreshed weekly. Ticketmaster is a partial listing, not an events census.</p>
          </section>
          <section className="nl-section" id="beer"><SectionTitle n="07" eyebrow="THE FIRST ROUND" title="What a beer costs."/><div className="nl-beer"><Beer size={32}/><div><h3>Domestic draught · 0.5 L</h3><strong>{r.beer ? beerAmount(r.beer.domestic, r.beer.domesticUsd) : "Not available"}</strong></div><div><h3>Imported bottle · 0.33 L</h3><strong>{r.beer ? beerAmount(r.beer.imported, r.beer.importedUsd) : "Not available"}</strong></div><p>Restaurant prices, not supermarket prices. A city average, not a quote for any specific bar.</p></div>{sourceLinks(r, ["numbeo"])}{r.beer && <p className="nl-footnote">Price observations updated {dateLabel(r.beer.updatedAt)}.</p>}</section>
        </div>
        <section id="travelers" className="nl-section"><SectionTitle n="08" eyebrow="THE WORD ON THE STREET" title="What travelers actually say."/>
          {themes.length ? <div className="nl-themes">{themes.map(([theme, items]) => <article key={theme}><h3>{theme}</h3><p>A recurring theme in {items.length} sourced {items.length === 1 ? "mention" : "mentions"}.</p><div>{items.slice(0, 3).map(m => <a key={m.id} href={m.url} target="_blank" rel="noopener noreferrer">{m.source === "blogs" ? "Travel write-up" : m.source === "reddit" ? "Reddit discussion" : "Foursquare tip"} · {dateLabel(m.publishedAt)} ↗</a>)}</div></article>)}</div> : <div className="nl-empty"><Moon size={23}/><h3>Traveler accounts are limited</h3><p>There aren’t enough recent, sourced traveler accounts to give this scene a Vibe score. Venue counts alone can’t tell us whether people had a good time.</p></div>}
          <p className="nl-footnote">{vibe.value == null ? "Vibe is not scored yet. " : ""}Themes summarize original accounts; they are not quotations. Positive, mixed and negative mentions all contribute to the score. No raw posts or article text are republished.</p>{sourceLinks(r, ["reddit", "blogs", "foursquare"])}</section>

        <section id="night-safety" className="nl-section"><SectionTitle n="09" eyebrow="HAVE A GOOD NIGHT. GET HOME SAFE." title="Safety after dark"/>
          {r.safety ? <><div className="nl-safety-summary"><div><ShieldCheck size={27}/><strong>{Math.round(r.safety.index)}<small>/100</small></strong><Stars value={r.scores.find(s => s.key === "safety")?.value ?? null}/></div><div><h3>The city’s safety picture</h3><p>{r.safety.summary}</p><p>40% existing safety score, 40% walking after dark, 20% traveler safety sentiment. Missing inputs are excluded and the remaining weights renormalized. Government advisory caps still apply.</p>{r.safety.signals.map(s => <p className="nl-footnote" key={s.label}>{s.label}: {s.value} · {s.source}{s.year ? ` · ${s.year}` : ""}</p>)}</div></div>
          <SafetyMap safety={r.safety} city={c.city} lat={c.lat} lon={c.lon}/>
          {r.safety.zones.length > 0 && <div className="nl-zones">{r.safety.zones.map(z => <article key={z.name}><span className={`nl-zone-label nl-zone-${z.level}`}>{z.level === "safe" ? "Safer" : z.level === "avoid" ? "Avoid" : "Use caution"}</span><h3>{z.name}</h3><p>{z.note}</p></article>)}</div>}
          <p className="nl-footnote">District guidance comes from the existing report’s research. It is not a measured crime rate for each venue cluster. Map areas without verified boundaries use approximate markers.</p></> : <p className="nl-empty">No usable safety report is available.</p>}
          {sourceLinks(r, ["safety"])}<div className="nl-safety-links"><Link href={c.safetyPath} className="nl-button">Read the full {c.city} safety report <ArrowUpRight size={16}/></Link><Link href={`/map?place=${encodeURIComponent(`${c.city}, ${c.country}`)}`}>Explore the full safety map ↗</Link></div>
        </section>
        <section id="sources" className="nl-section"><SectionTitle n="10" eyebrow="SHOWING OUR WORK" title="Sources and calculation details"/>
          <div className="nl-source-ledger">{r.sources.map(s => <article key={s.id}><div><a href={s.url} target="_blank" rel="noopener noreferrer">{s.name} ↗</a><span className={s.status === "ok" ? "nl-source-ok" : ""}>{s.status === "ok" ? dateLabel(s.fetchedAt) : s.status === "error" ? "Refresh issue" : "Unavailable"}</span></div><p>{s.note}</p><small>{s.licence}{s.fetchedAt && s.status !== "ok" ? ` · Last successful fetch ${dateLabel(s.fetchedAt)}` : ""}</small></article>)}</div>
          <details className="nl-methodology"><summary>The five formulas, with this city’s inputs</summary><p>Formula {r.formulaVersion}. Ratings are editorial calculations from source data, not user reviews. Density and Quality use provisional cut-offs pending pilot calibration. Variety uses effective types: under 2 → 1 star, 2–under 3 → 2, 3–under 4.5 → 3, 4.5–under 6 → 4, 6 or more → 5. Vibe gives older mentions half weight and caps a thread or article at 25%; fewer than four independent groups cannot be scored. Safety maps 0–20 to 1 star, over 20–40 to 2, over 40–60 to 3, over 60–80 to 4, over 80–100 to 5.</p>{r.scores.map(s => <div key={s.key} id={`method-${s.key}`}><h3>{s.label}</h3><ul>{s.bullets.map(b => <li key={b}>{b}</li>)}</ul><dl>{Object.entries(s.inputs).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value == null ? "Unavailable" : typeof value === "number" ? Number(value.toFixed(4)).toLocaleString("en") : value}</dd></div>)}</dl>{sourceLinks(r, s.sourceIds)}</div>)}</details>
          <p className="nl-footnote">Venues, ratings and mentions: monthly. Events: weekly. Population and beer prices: every six months. Each source keeps its actual fetch date; refreshing one block doesn’t make the others newer. <a href={`${nightlifePath(r)}/data.json`}>Download report data ↗</a> · OpenStreetMap-derived venue data is available under ODbL 1.0; proprietary ratings are excluded from the download.</p>
        </section>
        {nearby.length > 0 && <section className="nl-section"><SectionTitle n="↗" eyebrow="ANOTHER NIGHT, ANOTHER CITY" title="Nearby cities"/><div className="nl-nearby">{nearby.map(n => <Link href={nightlifePath(n)} key={n.city.key}><span>{n.city.country}</span><h3>{n.city.city} <ArrowUpRight size={18}/></h3><Stars value={n.overall}/><small>{Math.round(distance(c, n.city) / 1000).toLocaleString()} km away{n.outcome === "limited" ? " · Limited data" : ""}</small></Link>)}</div></section>}
        <SiteFooter/>
      </div>
    </main>
  </div>
}
