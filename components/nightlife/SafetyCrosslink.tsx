import Link from "next/link"
import { findNightlife, nightlifePath } from "@/lib/nightlife/store"
import { Stars } from "./Stars"
import "./nightlife.css"
export async function SafetyCrosslink({ country, city }: { country: string; city: string }) {
  const r = await findNightlife(country, city)
  if (!r) return null
  return <aside className="nl-safety-crosslink"><div><span>THE AFTER-DARK EDITION</span><h2>What’s {r.city.city} like at night?</h2><p>{r.venues.length} mapped venues. Bars, clubs, the local scene — and the safety side of a night out.</p><Stars value={r.overall}/>{r.outcome === "limited" && <p>Limited data · {r.scores.filter(s => s.value != null).length} of 5 ratings available</p>}</div><Link href={nightlifePath(r)}>Explore the nightlife report ↗</Link></aside>
}
