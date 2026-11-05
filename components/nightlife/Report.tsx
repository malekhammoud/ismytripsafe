import Link from "next/link"
import { ArrowUpRight, AudioLines, Beer, Clock3, MapPin, Moon, ShieldCheck, Sparkles } from "lucide-react"
import { SiteHeader } from "@/components/SiteHeader"
import { SiteFooter } from "@/components/SiteFooter"
import { Stars } from "./Stars"
import { VenueMap } from "./VenueMap"
import { SafetyMap } from "./SafetyMap"
import { nightlifePath, type NightlifeSummary } from "@/lib/nightlife/store"
import { distance } from "@/lib/nightlife/venues"
import { VENUE_TYPES, type NightlifeReport, type ScoreKey } from "@/lib/nightlife/types"
import { NIGHT_PHOTOS, plainCopy, priceBand, recentMentions, venueShortlist, venueSource } from "@/lib/nightlife/presentation"
import "./nightlife.css"
const ICONS = { density: MapPin, quality: Sparkles, variety: AudioLines, vibe: Moon, safety: ShieldCheck }
const DESCRIPTIONS: Record<ScoreKey, string> = { density: "How much there is", quality: "How good the venues are", variety: "How much choice you have", vibe: "How travelers felt", safety: "How safe a night out feels" }
export function dateLabel(date: string | null | undefined) { return date && Number.isFinite(Date.parse(date)) ? new Date(date).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" }) : "Date unavailable" }
export function NightlifeReportPage({ report: r, nearby }: { report: NightlifeReport; nearby: NightlifeSummary[] }) {
  const c = r.city, year = new Date(r.updatedAt).getUTCFullYear(), photo = NIGHT_PHOTOS[c.key]
  const counts = VENUE_TYPES.map(type => ({ type, count: r.venues.filter(v => v.type === type).length })).filter(t => t.count > 0).sort((a, b) => b.count - a.count)
  const ranked = venueShortlist(r), mentions = recentMentions(r.mentions)
  const themeCounts = new Map<string, typeof mentions>()
  for (const m of mentions) for (const theme of m.themes) themeCounts.set(theme, [...(themeCounts.get(theme) ?? []), m])
  const themes = [...themeCounts].sort((a, b) => b[1].length - a[1].length).slice(0, 4)
  const beer = r.beer
  const priceNotes = mentions.flatMap(m => m.themes.filter(t => /\b(cheap|expensive|affordable|pricey|prices|budget)\b/i.test(t)).map(theme => ({theme,m}))).filter((n,i,all) => all.findIndex(other => other.theme === n.theme) === i).slice(0,2)
  const hasPrices = (beer && [beer.domestic, beer.imported, beer.meal, (beer.taxiStart && beer.taxiPerKm ? beer.taxiStart + 5 * beer.taxiPerKm : null)].some(p => p != null && p > 0)) || priceNotes.length > 0
  const nightCost = beer?.meal && beer?.domestic ? beer.meal + 2 * beer.domestic : null
  const taxiCost = beer?.taxiStart && beer?.taxiPerKm ? beer.taxiStart + 5 * beer.taxiPerKm : null
  const band = beer ? priceBand(beer.domesticUsd ?? (beer.currency === "USD" ? beer.domestic : null)) : null
  const money = (amount: number) => new Intl.NumberFormat("en", { style: "currency", currency: beer!.currency, maximumFractionDigits: 2 }).format(amount)
  const source = r.sources.find(s => s.id === "numbeo" && s.fetchedAt)
  return <div className="nl-page nl-report">
    <SiteHeader />
    <main>
      <header className="nl-report-hero">
        {photo && <img className="nl-night-photo" src={photo.url} alt="" fetchPriority="high"/>}
        <div className="nl-container nl-hero-content">
          <h1>{c.city} Nightlife Report {year}</h1>
          <div className="nl-hero-rating"><Stars value={r.overall} large/>{r.overall != null && <span>{r.overall.toFixed(1)}<small>/5</small></span>}</div>
        </div>
      </header>
      <div className="nl-container nl-report-body">
        <section id="the-stars" className="nl-ratings" aria-label="The five ratings">
          <div className="nl-score-grid">{r.scores.map(score => { const Icon = ICONS[score.key]; return <article key={score.key} className={`nl-score ${score.value == null ? "nl-score-missing" : ""}`}><Icon size={19}/><h2>{score.label}</h2><p className="nl-score-question">{DESCRIPTIONS[score.key]}</p><Stars value={score.value}/></article> })}</div>
        </section>
        {r.venues.length > 0 && <section id="venues" className="nl-section nl-scene" aria-label="Venue mix">
          <div className="nl-scene-grid"><div className="nl-venue-total"><Beer size={26}/><strong>{r.venues.length.toLocaleString()}</strong><h2>places to start the evening</h2></div><div className="nl-breakdown">{counts.map(({ type, count }) => <div key={type} className="nl-bar-row"><div><span>{type}</span><strong>{count}</strong></div><div className="nl-bar-track"><span style={{ width: `${count / r.venues.length * 100}%` }}/></div></div>)}</div></div>
          <p className="nl-count-note">This only includes mapped locations within the city border. The real number is often higher.</p>
          <div id="hotspots" className="nl-scene-map"><VenueMap venues={r.venues} city={c.city} lat={c.lat} lon={c.lon}/></div>
        </section>}
        {ranked.length > 0 && <section className="nl-section" id="top-venues"><h2>Worth a stop</h2><ol className="nl-shortlist">{ranked.map(({venue: v, evidence, groups, rated}, i) => <li key={v.id}>
          <span className="nl-shortlist-rank">{i + 1}</span><div><h3><a href={venueSource(v)} target="_blank" rel="noopener noreferrer">{plainCopy(v.name)} <ArrowUpRight size={15}/></a></h3><p>{v.type}{v.neighborhood ? ` · ${plainCopy(v.neighborhood)}` : ""}</p>{groups > 0 && <p className="nl-shortlist-reason">{groups > 1 ? "Recommended across independent traveler accounts." : "Recommended in a traveler account."}</p>}<div className="nl-recommendation-links">{evidence.filter((m, index, all) => all.findIndex(other => other.group === m.group) === index).slice(0, 3).map(m => <a key={m.id} href={m.url} target="_blank" rel="noopener noreferrer">{m.source === "blogs" ? "Travel guide" : m.source === "reddit" ? "Reddit" : "Traveler tip"} ↗</a>)}</div></div>{rated && <div className="nl-venue-rating"><strong>{v.rating!.toFixed(1)}</strong><small>/10</small></div>}
        </li>)}</ol></section>}
        {r.lateness.known > 0 && <section id="late" className="nl-section"><h2>How Late Does {c.city} Keep Partying?</h2>
          <div className="nl-late-grid">{[["00:00", "Past midnight", r.lateness.afterMidnight], ["02:00", "Past 2 am", r.lateness.after2], ["04:00", "Past 4 am", r.lateness.after4]].map(([time, label, count]) => <div className="nl-late-card" key={time}><Clock3 size={18}/><span className="nl-clock">{time}</span><h3>{label}</h3><strong>{Math.round(Number(count) / r.lateness.known * 100)}%</strong><div className="nl-late-meter"><span style={{width:`${Number(count) / r.lateness.known * 100}%`}}/></div></div>)}</div>
        </section>}
        {hasPrices && <section id="prices" className="nl-section"><h2>Prices</h2><div className="nl-prices">{band && <div className="nl-price-band" aria-label={`${band} of 3 dollar signs, based on a domestic beer`}><span>{"$".repeat(band)}</span><span aria-hidden="true">{"$".repeat(3 - band)}</span></div>}<div className="nl-price-amounts">{beer && beer.domestic != null && beer.domestic > 0 && <p><span>Beer <small>0.5 L draught</small></span><strong>{money(beer.domestic)}</strong></p>}{beer && beer.imported != null && beer.imported > 0 && <p><span>Imported beer <small>0.33 L bottle</small></span><strong>{money(beer.imported)}</strong></p>}{beer?.meal != null && beer.meal > 0 && nightCost == null && <p><span>Meal <small>inexpensive restaurant</small></span><strong>{money(beer.meal)}</strong></p>}{nightCost != null && <p><span>Meal + two beers</span><strong>{money(nightCost)}</strong></p>}{taxiCost != null && <p><span>Taxi <small>5 km, normal tariff</small></span><strong>{money(taxiCost)}</strong></p>}</div>{priceNotes.length > 0 && <div className="nl-price-notes">{priceNotes.map(({theme,m}) => <a key={theme} href={m.url} target="_blank" rel="noopener noreferrer">{plainCopy(theme)} ↗</a>)}</div>}{source && beer && <a className="nl-price-source" href={source.url} target="_blank" rel="noopener noreferrer">Numbeo · {dateLabel(beer.updatedAt)} ↗</a>}</div></section>}
        {r.safety && <section id="night-safety" className="nl-section"><h2>Safety after dark</h2>
          <div className="nl-safety-summary"><div><ShieldCheck size={27}/><strong>{Math.round(r.safety.index)}<small>/100</small></strong><Stars value={r.scores.find(s => s.key === "safety")?.value ?? null}/></div><div><p>{plainCopy(r.safety.summary)}</p><p>{c.key === "pt_porto" ? "The main concern is pickpocketing in crowded areas." : r.safety.zones.some(z => z.level === "avoid") ? "Plan your route around the districts marked below." : "Keep valuables secure in busy nightlife areas."}</p><p>To learn more, see our <Link href={c.safetyPath}>{year} {c.city} Safety Report ↗</Link></p></div></div>
          {r.safety.zones.length > 0 && <><SafetyMap safety={r.safety} city={c.city} lat={c.lat} lon={c.lon}/><div className="nl-zones">{r.safety.zones.map(z => <article key={z.name}><span className={`nl-zone-label nl-zone-${z.level}`}>{z.level === "safe" ? "Safer" : z.level === "avoid" ? "Avoid" : "Use caution"}</span><h3>{plainCopy(z.name)}</h3><p>{plainCopy(z.note)}</p></article>)}</div></>}
        </section>}
        {themes.length > 0 && <section id="travelers" className="nl-section"><h2>What travelers say</h2><div className="nl-themes">{themes.map(([theme, items]) => <article key={theme}><h3>{plainCopy(theme)}</h3><div>{items.filter((m, i, all) => all.findIndex(other => other.url === m.url) === i).slice(0, 2).map(m => <a key={m.id} href={m.url} target="_blank" rel="noopener noreferrer">{m.source === "blogs" ? "Travel write-up" : m.source === "reddit" ? "Reddit discussion" : "Foursquare tip"} ↗</a>)}</div></article>)}</div></section>}
        {nearby.length > 0 && <section className="nl-section"><h2>Nearby cities</h2><div className="nl-nearby">{nearby.map(n => <Link href={nightlifePath(n)} key={n.city.key}><span>{n.city.country}</span><h3>{n.city.city} <ArrowUpRight size={18}/></h3><Stars value={n.overall}/><small>{Math.round(distance(c, n.city) / 1000).toLocaleString()} km away</small></Link>)}</div></section>}
        <footer className="nl-report-notes"><Link href={`/methodology/nightlife?country=${c.countrySlug}&city=${c.citySlug}`}>How we score this ↗</Link><span>Updated <time dateTime={r.updatedAt}>{dateLabel(r.updatedAt)}</time></span><span>© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a></span>{photo && <span>Photo: <a href={photo.authorUrl ?? photo.source}>{photo.author}</a> · <a href={photo.licence}>CC BY-SA 3.0</a> · cropped and darkened</span>}</footer>
        <SiteFooter simplePunctuation/>
      </div>
    </main>
  </div>
}
