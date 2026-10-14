import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  type BatterySample,
  chargeSessions,
  downsample,
  driveEnergy,
  efficiencyKmPerKwh,
  elevation,
  isNoise,
  MIN_DRIVE_M,
  SESSION_GAP_MS,
  SOC_LOOKBACK_MS,
} from '../src/stats.ts'

const PACK = 142.21
const at = (ts: number, socPct: number): BatterySample => ({ ts, socPct, packEnergyKwh: PACK })

test('elevation ignores changes below the noise threshold', () => {
  assert.deepEqual(elevation([100, 101, 102, 101, 100, 102]), {
    gainM: 0,
    lossM: 0,
    minM: 100,
    maxM: 102,
  })
})

test('elevation sums climb and descent', () => {
  assert.deepEqual(elevation([100, 110, 120, 105, null, 130]), {
    gainM: 45,
    lossM: 15,
    minM: 100,
    maxM: 130,
  })
})

test('elevation is null without altitude', () => {
  assert.equal(elevation([null, null]), null)
  assert.equal(elevation([]), null)
})

// SoC samples recorded around the 2026-10-11 19:48 drive (16.2 km).
const DRIVE = { startedAt: 1791748116808, endedAt: 1791749497878 }
const SAMPLES = [
  at(1791748058050, 48.7),
  at(1791748320803, 48.4),
  at(1791749296715 - 180_000, 46.4),
  at(1791749496715, 46.2),
]

test('driveEnergy uses the SoC drop times pack capacity', () => {
  assert.deepEqual(driveEnergy(SAMPLES, DRIVE.startedAt, DRIVE.endedAt), {
    socStartPct: 48.7,
    socEndPct: 46.2,
    energyKwh: 3.56,
  })
})

test('driveEnergy is null without a recent start sample', () => {
  assert.equal(driveEnergy(SAMPLES.slice(1), DRIVE.startedAt, DRIVE.endedAt), null)
  const stale = [at(DRIVE.startedAt - SOC_LOOKBACK_MS - 1, 48.7), ...SAMPLES.slice(1)]
  assert.equal(driveEnergy(stale, DRIVE.startedAt, DRIVE.endedAt), null)
})

test('driveEnergy is null when start and end share one sample', () => {
  assert.equal(driveEnergy([at(0, 50)], 10, 20), null)
})

test('efficiencyKmPerKwh divides distance by energy', () => {
  assert.equal(efficiencyKmPerKwh(16_200, 3.56), 4.55)
  assert.equal(efficiencyKmPerKwh(16_200, 0), null)
  assert.equal(efficiencyKmPerKwh(16_200, null), null)
})

test('chargeSessions finds a rising SoC run and trims flat ends', () => {
  const min = 60_000
  const sessions = chargeSessions([
    at(0, 40),
    at(1 * min, 40),
    at(2 * min, 41),
    at(3 * min, 43),
    at(4 * min, 45),
    at(5 * min, 45),
    at(6 * min, 44.9),
  ])
  assert.deepEqual(sessions, [
    {
      startedAt: 1 * min,
      endedAt: 4 * min,
      socStartPct: 40,
      socEndPct: 45,
      energyKwh: 7.11,
    },
  ])
})

test('chargeSessions splits on a gap and drops small rises', () => {
  const sessions = chargeSessions([
    at(0, 40),
    at(60_000, 42),
    at(60_000 + SESSION_GAP_MS + 1, 42.5),
    at(120_000 + SESSION_GAP_MS, 43),
  ])
  assert.equal(sessions.length, 1)
  assert.equal(sessions[0].socEndPct, 42)
})

test('isNoise drops short drives and drives that never closed', () => {
  assert.equal(isNoise(MIN_DRIVE_M - 1, 60_000), true)
  // 2026-10-09: 1.4 mi of parked GPS drift over 14 h 11 min.
  assert.equal(isNoise(2_253, 51_060_000), true)
  assert.equal(isNoise(16_200, 1_381_070), false)
  assert.equal(isNoise(MIN_DRIVE_M, null), false)
})

test('downsample keeps the first and last item', () => {
  const items = Array.from({ length: 101 }, (_, i) => i)
  const out = downsample(items, 5)
  assert.deepEqual(out, [0, 25, 50, 75, 100])
  assert.deepEqual(downsample([1, 2], 5), [1, 2])
})

test('driveEnergy returns null when the end sample is stale', () => {
  const samples = [at(0, 80), at(60_000, 79)]
  assert.equal(driveEnergy(samples, 0, 2 * 3_600_000), null)
})
