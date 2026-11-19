// Draws the two globe posters: the instant still that shows while WebGL is
// loading (or instead of it, on a machine that shouldn't run WebGL at all).
//
//   node scripts/build-globe-poster.mjs
//
// An orthographic projection of the same 110m TopoJSON the live globe starts
// with, at the same opening angle (22°N, 22°W). No dependencies beyond
// topojson-client and sharp, both already in the project; no browser, no
// screenshot, no drift between the poster and the thing it stands in for.
//
// Output: public/geo/globe-day.webp and public/geo/globe-night.webp.
import { feature } from "topojson-client"
import sharp from "sharp"
import { readFileSync, readdirSync, existsSync } from "node:fs"
import path from "node:path"

const W = 1400
const H = 1000
const CX = W / 2
const CY = 476
const R = 404
const RAD = Math.PI / 180
const LAT0 = 22 * RAD
const LNG0 = -22 * RAD

function project(lng, lat) {
  const phi = lat * RAD
  const dLng = lng * RAD - LNG0
  const cosc = Math.sin(LAT0) * Math.sin(phi) + Math.cos(LAT0) * Math.cos(phi) * Math.cos(dLng)
  if (cosc <= 0.002) return null // behind the horizon
  const x = CX + R * Math.cos(phi) * Math.sin(dLng)
  const y = CY - R * (Math.cos(LAT0) * Math.sin(phi) - Math.sin(LAT0) * Math.cos(phi) * Math.cos(dLng))
  return [x, y]
}

const fmt = (n) => n.toFixed(1)

/** One ring as visible runs. A run that crosses the horizon stays open; the
 *  circle clip cuts it at the rim, which is what the eye expects. */
function ringPath(coords) {
  const runs = []
  let run = []
  let allVisible = true
  for (const [lng, lat] of coords) {
    const p = project(lng, lat)
    if (p) run.push(p)
    else {
      allVisible = false
      if (run.length > 1) runs.push(run)
      run = []
    }
  }
  if (run.length > 1) runs.push(run)
  return runs
    .map((pts) => {
      const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${fmt(x)} ${fmt(y)}`).join(" ")
      return allVisible ? `${d}Z` : d
    })
    .join(" ")
}

function graticule(color) {
  const parts = []
  for (let lat = -60; lat <= 60; lat += 30) {
    let run = []
    const runs = []
    for (let lng = -180; lng <= 180; lng += 3) {
      const p = project(lng, lat)
      if (p) run.push(p)
      else {
        if (run.length > 1) runs.push(run)
        run = []
      }
    }
    if (run.length > 1) runs.push(run)
    for (const pts of runs) {
      parts.push(
        `<path d="${pts.map(([x, y], i) => `${i ? "L" : "M"}${fmt(x)} ${fmt(y)}`).join(" ")}"/>`,
      )
    }
  }
  for (let lng = -180; lng < 180; lng += 30) {
    let run = []
    const runs = []
    for (let lat = -90; lat <= 90; lat += 3) {
      const p = project(lng, lat)
      if (p) run.push(p)
      else {
        if (run.length > 1) runs.push(run)
        run = []
      }
    }
    if (run.length > 1) runs.push(run)
    for (const pts of runs) {
      parts.push(
        `<path d="${pts.map(([x, y], i) => `${i ? "L" : "M"}${fmt(x)} ${fmt(y)}`).join(" ")}"/>`,
      )
    }
  }
  return `<g fill="none" stroke="${color}" stroke-width="0.7" opacity="0.5">${parts.join("")}</g>`
}

const topo = JSON.parse(readFileSync("public/geo/countries-110m.json", "utf8"))
const fc = feature(topo, topo.objects.countries)
const land = fc.features
  .map((f) => {
    const g = f.geometry
    if (!g) return ""
    const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates
    const d = polys.map((rings) => rings.map(ringPath).join(" ")).join(" ")
    return d ? `<path d="${d}"/>` : ""
  })
  .join("")

function shell({ id, sea, seaEdge, landFill, landStroke, grid, glow, dots = "" }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="sea-${id}" cx="42%" cy="36%" r="72%">
      <stop offset="0%" stop-color="${sea}"/>
      <stop offset="72%" stop-color="${sea}"/>
      <stop offset="100%" stop-color="${seaEdge}"/>
    </radialGradient>
    <radialGradient id="glow-${id}" cx="50%" cy="50%" r="50%">
      <stop offset="84%" stop-color="${glow}" stop-opacity="0"/>
      <stop offset="92%" stop-color="${glow}" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="${glow}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="shade-${id}" cx="38%" cy="30%" r="78%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.05"/>
      <stop offset="52%" stop-color="#ffffff" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.28"/>
    </radialGradient>
    <clipPath id="clip-${id}"><circle cx="${CX}" cy="${CY}" r="${R}"/></clipPath>
  </defs>
  <g clip-path="url(#clip-${id})">
    <circle cx="${CX}" cy="${CY}" r="${R}" fill="url(#sea-${id})"/>
    ${graticule(grid)}
    <g fill="${landFill}" stroke="${landStroke}" stroke-width="0.9" stroke-linejoin="round">${land}</g>
    ${dots}
    <circle cx="${CX}" cy="${CY}" r="${R}" fill="url(#shade-${id})"/>
  </g>
  <circle cx="${CX}" cy="${CY}" r="${R + 40}" fill="url(#glow-${id})"/>
  <circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="${glow}" stroke-opacity="0.16" stroke-width="1.4"/>
</svg>`
}

const day = shell({
  id: "day",
  sea: "#0d5f74",
  seaEdge: "#07333f",
  landFill: "rgba(233, 214, 178, 0.46)",
  landStroke: "rgba(255, 253, 246, 0.24)",
  grid: "rgba(190, 235, 240, 0.16)",
  glow: "#ffc857",
})

// ── Night: the same sphere with the published nightlife cities lit ─────
let dots = ""
const NIGHT_DIR = "/var/lib/ismytripsafe/nightlife/reports"
if (existsSync(NIGHT_DIR)) {
  const circles = []
  for (const name of readdirSync(NIGHT_DIR)) {
    if (!name.endsWith(".json") || name.includes(".tmp")) continue
    try {
      const report = JSON.parse(readFileSync(path.join(NIGHT_DIR, name), "utf8"))
      if (report.outcome === "withheld") continue
      const lat = report.city?.lat
      const lng = report.city?.lon
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
      const p = project(lng, lat)
      if (!p) continue
      const [x, y] = p
      const r = 2.2 + Math.min(3.2, Math.log2((report.venues?.length ?? 1) + 1) * 0.55)
      circles.push(
        `<circle cx="${fmt(x)}" cy="${fmt(y)}" r="${fmt(r * 2.6)}" fill="#ffcb8c" opacity="0.10"/>`,
        `<circle cx="${fmt(x)}" cy="${fmt(y)}" r="${fmt(r * 1.6)}" fill="#ffcb8c" opacity="0.18"/>`,
        `<circle cx="${fmt(x)}" cy="${fmt(y)}" r="${fmt(r)}" fill="#ffe0b0" opacity="0.92"/>`,
      )
    } catch {
      // A half-written report is not a reason to fail the build.
    }
  }
  dots = `<g>${circles.join("")}</g>`
}

const night = shell({
  id: "night",
  sea: "#171238",
  seaEdge: "#080614",
  landFill: "rgba(120, 126, 214, 0.30)",
  landStroke: "rgba(170, 172, 255, 0.22)",
  grid: "rgba(170, 172, 255, 0.12)",
  glow: "#6d5cff",
  dots,
})

await sharp(Buffer.from(day)).webp({ quality: 82, effort: 6 }).toFile("public/geo/globe-day.webp")
await sharp(Buffer.from(night)).webp({ quality: 82, effort: 6 }).toFile("public/geo/globe-night.webp")

for (const f of ["public/geo/globe-day.webp", "public/geo/globe-night.webp"]) {
  console.log(f, `${(readFileSync(f).length / 1024).toFixed(0)}KB`)
}
