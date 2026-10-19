import Link from "next/link"
import { findNightlife, nightlifePath } from "@/lib/nightlife/store"
import { getCityReport } from "@/lib/reports"
import { Stars } from "./Stars"
import { OnDemandReport } from "./OnDemandReport"
import "./nightlife.css"
export async function SafetyCrosslink({ country, city }: { country: string; city: string }) {
  const r = await findNightlife(country, city)
  if (r) return <><OnDemandReport country={country} city={city} cityName={r.city.city} mode="refresh"/><aside className="nl-safety-crosslink"><div><span>THE AFTER-DARK EDITION</span><h2>What’s {r.city.city} like at night?</h2><p>{r.venues.length} mapped venues. Bars, clubs, the local scene — and the safety side of a night out.</p><Stars value={r.overall}/>{r.outcome === "limited" && <p>Limited data · {r.scores.filter(s => s.value != null).length} of 5 ratings available</p>}</div><Link href={nightlifePath(r)}>Explore the nightlife report ↗</Link></aside></>
  const hit = await getCityReport(country, city)
  if (!hit) return null
  return <aside className="nl-safety-crosslink"><div><span>THE AFTER-DARK EDITION</span><h2>What’s {hit.meta.city} like at night?</h2><p>Bars, clubs, the atmosphere — and the safety side of a night out.</p></div><OnDemandReport country={country} city={city} cityName={hit.meta.city} mode="teaser"/></aside>
}
