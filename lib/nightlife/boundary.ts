export interface Boundary { outer: number[][][]; inner: number[][][] }
interface Member { type: string; role: string; geometry?: { lat: number; lon: number }[] }
const same = (a: number[], b: number[]) => a[0] === b[0] && a[1] === b[1]
function rings(parts: number[][][]): number[][][] | null {
  const pending = parts.map(p => [...p]), result: number[][][] = []
  while (pending.length) {
    const ring = pending.pop()!
    let guard = pending.length + 1
    while (!same(ring[0], ring[ring.length - 1]) && guard-- > 0) {
      const i = pending.findIndex(p => same(ring[ring.length - 1], p[0]) || same(ring[ring.length - 1], p[p.length - 1]))
      if (i < 0) return null
      const part = pending.splice(i, 1)[0]
      if (!same(ring[ring.length - 1], part[0])) part.reverse()
      ring.push(...part.slice(1))
    }
    if (ring.length < 4 || !same(ring[0], ring[ring.length - 1])) return null
    result.push(ring)
  }
  return result
}
export function boundaryFromMembers(members: Member[] | undefined): Boundary | null {
  if (!members?.length) return null
  const edges = (role: string) => members.filter(m => m.type === "way" && (m.role === role || (role === "outer" && m.role === ""))).map(m => (m.geometry ?? []).map(p => [p.lon, p.lat]))
  const outerParts = edges("outer"), innerParts = edges("inner")
  if (!outerParts.length || outerParts.some(p => p.length < 2) || innerParts.some(p => p.length < 2)) return null
  const outer = rings(outerParts), inner = rings(innerParts)
  return outer && inner ? { outer, inner } : null
}
function inRing(x: number, y: number, ring: number[][]) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j]
    // Boundary points are included.
    if (Math.abs((y - yi) * (xj - xi) - (x - xi) * (yj - yi)) < 1e-10 && x >= Math.min(xi, xj) && x <= Math.max(xi, xj) && y >= Math.min(yi, yj) && y <= Math.max(yi, yj)) return true
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside
  }
  return inside
}
export function withinBoundary(p: { lat: number; lon: number }, boundary: Boundary) {
  return boundary.outer.some(r => inRing(p.lon, p.lat, r)) && !boundary.inner.some(r => inRing(p.lon, p.lat, r))
}
