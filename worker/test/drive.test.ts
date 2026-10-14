import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  close,
  type Drive,
  distanceM,
  isOlderPoint,
  onPoint,
  PARK_GRACE_MS,
  type Point,
  parkedAfterGap,
  shouldClose,
} from '../src/drive.ts'

const point = (ts: number, lat: number, speedMps: number): Point => ({
  ts,
  lat,
  lon: 0,
  alt: null,
  speedMps,
  bearing: null,
})

/** Opens a drive: parks at lat 0, then moves 0.001 degree (~111 m) north. */
const open = (): Drive => {
  const { parkedAt } = onPoint(null, null, 'v', point(0, 0, 0), 100)
  const { drive } = onPoint(null, parkedAt, 'v', point(1_000, 0.001, 10), 100)
  assert.ok(drive)
  return drive
}

test('distanceM: 0.01 degree of latitude is about 1112 m', () => {
  assert.equal(Math.round(distanceM(0, 0, 0.01, 0)), 1112)
})

test('the first parked point becomes the parked position', () => {
  const p = point(0, 0, 0.5)
  assert.deepEqual(onPoint(null, null, 'v', p, null), { drive: null, parkedAt: p, stored: null })
})

test('a parked vehicle with a high speed reading does not start a drive', () => {
  // Live on a charger: GNSS field 6 (horizontal error) read 2.0-2.4 as speed, position unchanged.
  let parkedAt: Point | null = null
  for (let i = 0; i < 60; i++) {
    const result = onPoint(null, parkedAt, 'v', point(i * 60_000, 40.1494598, 2 + i * 0.01), null)
    assert.equal(result.drive, null)
    parkedAt = result.parkedAt
  }
  assert.equal(parkedAt?.ts, 0)
})

test('a drive opens at the parked position once the vehicle moves 25 m', () => {
  const { parkedAt } = onPoint(null, null, 'v', point(0, 0, 0), 100)
  // 0.0002 degree is ~22 m: still parked.
  assert.equal(onPoint(null, parkedAt, 'v', point(500, 0.0002, 3), 100).drive, null)

  const {
    drive,
    parkedAt: after,
    stored,
  } = onPoint(null, parkedAt, 'v', point(1_000, 0.001, 10), 100)
  assert.ok(drive && stored)
  assert.equal(after, null)
  assert.equal(drive.id, 'v-1000')
  assert.equal(drive.startLat, 0)
  assert.equal(drive.endLat, 0.001)
  assert.equal(Math.round(drive.distanceM), 111)
})

test('a drive stores one point per 5 s and sums distance', () => {
  let drive: Drive | null = open()
  let stored: Point | null

  ;({ drive, stored } = onPoint(drive, null, 'v', point(2_000, 0.002, 10), 100))
  assert.equal(stored, null)

  ;({ drive, stored } = onPoint(drive, null, 'v', point(6_000, 0.011, 20), 101))
  assert.ok(drive && stored)
  assert.equal(drive.pointCount, 2)
  assert.equal(Math.round(drive.distanceM), 1223)
  assert.equal(drive.maxSpeedMps, 20)
  assert.equal(drive.endOdometerKm, 101)

  const closed = close(drive, 102)
  assert.equal(closed.endedAt, 6_000)
  assert.equal(closed.endOdometerKm, 102)
})

test('a closed drive ends where it last moved, not at the parked points after it', () => {
  let drive: Drive | null = open()
  ;({ drive } = onPoint(drive, null, 'v', point(60_000, 0.01, 20), null))
  ;({ drive } = onPoint(drive, null, 'v', point(120_000, 0.01, 0), null))
  ;({ drive } = onPoint(drive, null, 'v', point(180_000, 0.01, 0), null))
  assert.ok(drive)
  assert.equal(drive.lastStoredAt, 180_000)
  const closed = close(drive, null)
  assert.equal(closed.endedAt, 60_000)
  assert.equal(closed.endLat, 0.01)
})

test('only position changes count as moving', () => {
  let drive: Drive | null = open()
  // High speed reading, same position: not moving.
  ;({ drive } = onPoint(drive, null, 'v', point(60_000, 0.001, 5), null))
  assert.ok(drive)
  assert.equal(drive.lastMovingAt, 1_000)
  // 0.001 degree further: moving.
  ;({ drive } = onPoint(drive, null, 'v', point(120_000, 0.002, 0), null))
  assert.ok(drive)
  assert.equal(drive.lastMovingAt, 120_000)
})

test('a restored drive without a moving position stays open while the vehicle moves', () => {
  const { movingLat: _, movingLon: __, ...legacy } = open()
  let drive: Drive | null = legacy
  // 2 m/s north, one point every 5 s (10 m apart, under MOVE_DISTANCE_M), for three minutes.
  for (let ts = 6_000; ts <= 176_000; ts += 5_000) {
    const lat = 0.001 + (((ts - 1_000) / 1_000) * 2) / 111_195
    ;({ drive } = onPoint(drive, null, 'v', point(ts, lat, 2), null))
    assert.ok(drive)
  }
  assert.ok(drive.lastMovingAt >= 166_000)
  assert.equal(shouldClose(drive, 181_001, null), false)
})

test('a restored drive without a moving position closes after the grace period when parked', () => {
  const { movingLat: _, movingLon: __, ...legacy } = open()
  const { drive } = onPoint(legacy, null, 'v', point(60_000, 0.001, 5), null)
  assert.ok(drive)
  assert.equal(drive.lastMovingAt, 1_000)
  assert.equal(shouldClose(drive, 1_000 + PARK_GRACE_MS + 1, null), true)
})

test('shouldClose on power down or after the park grace period', () => {
  const drive = open()
  assert.equal(shouldClose(drive, 2_000, 'go'), false)
  assert.equal(shouldClose(drive, 2_000, 'sleep'), true)
  assert.equal(shouldClose(drive, 1_000 + PARK_GRACE_MS + 1, null), true)
})

test('the parked position is dropped after a gap in points, kept otherwise', () => {
  const parked = point(0, 0, 0)
  const last = point(1_000, 0, 0)
  assert.equal(parkedAfterGap(parked, last, point(1_000 + PARK_GRACE_MS, 0.5, 0)), parked)
  assert.equal(parkedAfterGap(parked, last, point(1_000 + PARK_GRACE_MS + 1, 0.5, 0)), null)
  assert.equal(parkedAfterGap(parked, null, point(0, 0.5, 0)), parked)
})

test('a drive that starts from the end of the previous one opens at its first moving point', () => {
  // The previous drive ended at lat 0.001; the first update after waking is 67 m further.
  const end = point(0, 0.001, 0)
  const { drive } = onPoint(null, end, 'v', point(1_000, 0.0016, 5), null)
  assert.ok(drive)
  assert.equal(drive.startLat, 0.001)
})

test('a replayed older point is ignored, an equal or newer one is not', () => {
  const last = point(6_000, 0.002, 0)
  assert.equal(isOlderPoint(last, point(1_000, 0.001, 0)), true)
  assert.equal(isOlderPoint(last, point(6_000, 0.002, 0)), false)
  assert.equal(isOlderPoint(last, point(7_000, 0.002, 0)), false)
  assert.equal(isOlderPoint(null, point(0, 0, 0)), false)
})
