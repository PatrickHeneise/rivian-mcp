// Route simplification. Pure functions, no I/O.

/** [lon, lat], the GeoJSON order. */
export type LonLat = [number, number]

/**
 * Douglas-Peucker down to at most `maxPoints`, keeping the first and last point. The
 * tolerance is found by bisection on the perpendicular distance (in degrees, with longitude
 * scaled by the cosine of the latitude), so the result keeps the shape rather than every Nth
 * fix. Returns ascending indices into the input, preserving time and altitude at each fix.
 */
export function simplifyIndices(points: readonly LonLat[], maxPoints: number): number[] {
  if (points.length <= Math.max(2, maxPoints)) return points.map((_, i) => i)
  const keep = new Set<number>()
  let lo = 0
  let hi = extentDeg(points)
  let best = douglasPeucker(points, hi, keep)
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2
    const result = douglasPeucker(points, mid, keep)
    if (result.length <= maxPoints) {
      best = result
      hi = mid
    } else {
      lo = mid
    }
    if (hi - lo < 1e-8) break
  }
  return best
}

function douglasPeucker(points: readonly LonLat[], tolerance: number, keep: Set<number>): number[] {
  keep.clear()
  keep.add(0)
  keep.add(points.length - 1)
  const stack: [number, number][] = [[0, points.length - 1]]
  while (stack.length > 0) {
    const [first, last] = stack.pop() as [number, number]
    let maxDist = 0
    let index = -1
    for (let i = first + 1; i < last; i++) {
      const d = distanceToSegment(points[i], points[first], points[last])
      if (d > maxDist) {
        maxDist = d
        index = i
      }
    }
    if (index !== -1 && maxDist > tolerance) {
      keep.add(index)
      stack.push([first, index], [index, last])
    }
  }
  return [...keep].sort((a, b) => a - b)
}

function extentDeg(points: readonly LonLat[]): number {
  let minLon = Infinity
  let maxLon = -Infinity
  let minLat = Infinity
  let maxLat = -Infinity
  for (const [lon, lat] of points) {
    if (lon < minLon) minLon = lon
    if (lon > maxLon) maxLon = lon
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
  }
  return Math.hypot(maxLon - minLon, maxLat - minLat) || 1
}

/** Perpendicular distance in degrees, longitude scaled so a degree is the same length either way. */
function distanceToSegment(p: LonLat, a: LonLat, b: LonLat): number {
  const scale = Math.cos((p[1] * Math.PI) / 180)
  const px = p[0] * scale
  const ax = a[0] * scale
  const bx = b[0] * scale
  const dx = bx - ax
  const dy = b[1] - a[1]
  const lengthSq = dx * dx + dy * dy
  let t = lengthSq === 0 ? 0 : ((px - ax) * dx + (p[1] - a[1]) * dy) / lengthSq
  t = Math.max(0, Math.min(1, t))
  const x = ax + t * dx - px
  const y = a[1] + t * dy - p[1]
  return Math.sqrt(x * x + y * y)
}
