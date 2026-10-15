import assert from 'node:assert/strict'
import { test } from 'node:test'
import { type LonLat, simplify, simplifyIndices } from '../src/simplify.ts'
import { boulderToLongmont } from './support/d1.ts'

const track = (): LonLat[] => boulderToLongmont().map((p) => [p.lon, p.lat])

test('simplify returns a copy when the track already fits', () => {
  const points: LonLat[] = [
    [0, 0],
    [1, 1],
    [2, 0],
  ]
  const out = simplify(points, 3)
  assert.deepEqual(out, points)
  assert.notEqual(out, points)
})

test('simplify keeps both ends and at most max points', () => {
  const points = track()
  const out = simplify(points, 100)
  assert.ok(out.length <= 100, `got ${out.length}`)
  assert.ok(out.length >= 50, `too aggressive: ${out.length}`)
  assert.deepEqual(out[0], points[0])
  assert.deepEqual(out.at(-1), points.at(-1))
})

test('simplify collapses a straight line to its ends', () => {
  const points: LonLat[] = Array.from({ length: 50 }, (_, i) => [i * 0.01, i * 0.01])
  assert.deepEqual(simplify(points, 10), [points[0], points.at(-1)])
})

test('simplifyIndices is ascending and keeps the bend', () => {
  const points = track()
  const kept = simplifyIndices(points, 20)
  assert.equal(kept[0], 0)
  assert.equal(kept.at(-1), points.length - 1)
  assert.deepEqual(
    kept,
    [...kept].sort((a, b) => a - b),
  )
  // The bend sits at 40 % of the track; some kept index lands within a few points of it.
  const bendIndex = Math.round(0.4 * (points.length - 1))
  assert.ok(
    kept.some((i) => Math.abs(i - bendIndex) <= 3),
    `bend lost: ${kept.join(',')}`,
  )
})

test('simplify honors max_points on a diagonal loop', () => {
  const loop: [number, number][] = [
    [0, 0],
    [1, 1],
    [0, 0],
  ]
  assert.equal(simplify(loop, 2).length, 2)
})
