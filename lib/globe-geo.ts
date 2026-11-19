// Country geometry for the two globes.
//
// The globe used to open with `countries-50m.json` — 756 KB of TopoJSON,
// roughly seven times the vertex count of the 110m file, parsed and
// triangulated on the main thread before the first frame. At the size the
// globe is actually drawn (a 900px sphere) 110m is indistinguishable, and at
// the size it is drawn when you zoom in, 110m is not. So the first render
// uses 110m and the detailed file replaces it only when the camera comes in
// close enough to see the difference.
import { feature } from "topojson-client"
import type { GeometryCollection, Topology } from "topojson-specification"

export interface GlobeFeature {
  type: "Feature"
  id?: string | number
  properties: { name?: string }
  geometry: unknown
}

type Position = [number, number]
type Ring = Position[]
type PolygonCoords = Ring[]

/**
 * world-atlas folds French Guiana INTO France's polygon (its landmass is one
 * of France's MultiPolygon parts), so the whole region used to tint and click
 * as France. Detach it: pull the South-American polygon out of France and
 * present it as its own feature — sand, "No report yet" — exactly like every
 * other country we haven't reported on. Works for any topology file, because
 * it uses the real geometry.
 */
export function countryFeatures(
  topo: Topology<{ countries: GeometryCollection }>,
): GlobeFeature[] {
  const fc = feature(topo, topo.objects.countries) as unknown as { features: GlobeFeature[] }
  const feats = fc.features

  if (!feats.some((f) => String(f.id) === "254")) {
    const france = feats.find((f) => String(f.id) === "250")
    if (france) {
      const geom = france.geometry as { type: string; coordinates: unknown }
      const polys =
        geom.type === "MultiPolygon"
          ? (geom.coordinates as PolygonCoords[])
          : ([geom.coordinates] as PolygonCoords[])
      const guyanese = polys.filter((p) =>
        p[0].some((c) => c[1] < 10 && c[0] < -50),
      )
      if (guyanese.length) {
        for (const p of guyanese) {
          feats.push({
            type: "Feature",
            id: "254",
            properties: { name: "French Guiana" },
            geometry: { type: "Polygon", coordinates: p },
          })
        }
        if (geom.type === "MultiPolygon") {
          geom.coordinates = polys.filter((p) => !guyanese.includes(p))
        }
      }
    }
  }

  return feats
}

/** Fetch and convert one of the two world-atlas files. */
export async function loadCountryFeatures(url: string): Promise<GlobeFeature[]> {
  const topo = (await fetch(url, { cache: "force-cache" }).then((r) => r.json())) as Topology<{
    countries: GeometryCollection
  }>
  return countryFeatures(topo)
}
