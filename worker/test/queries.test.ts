import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { test } from 'node:test'
import {
  DAILY_CAPACITY_SQL,
  DRIVE_WINDOW_SAMPLES_SQL,
  RANGE_POINTS_SQL,
  STATS_POINTS_SQL,
} from '../src/queries.ts'

const DAY = 86_400_000

function db(): DatabaseSync {
  const d = new DatabaseSync(':memory:')
  const dir = join(import.meta.dirname, '../migrations')
  for (const f of readdirSync(dir).sort()) d.exec(readFileSync(join(dir, f), 'utf8'))
  return d
}

function drive(d: DatabaseSync, id: string, startedAt: number, endedAt: number | null) {
  d.prepare(
    `INSERT INTO drives (id, vehicle_id, started_at, ended_at, start_lat, start_lon, end_lat, end_lon, distance_m)
VALUES (?, 'v1', ?, ?, 0, 0, 0, 0, 5000)`,
  ).run(id, startedAt, endedAt)
}

function sample(d: DatabaseSync, ts: number, data: object, vehicle = 'v1') {
  d.prepare('INSERT INTO charge_samples VALUES (?, ?, ?, ?, ?)').run(
    vehicle,
    ts,
    'battery',
    JSON.stringify(data),
    '',
  )
}

test('daily capacity keeps the last reading per day', () => {
  const d = db()
  sample(d, 1000, { packEnergyKwh: 100 })
  sample(d, 2000, { packEnergyKwh: 101 })
  sample(d, DAY + 5, { packEnergyKwh: 102 })
  sample(d, DAY + 9, { socPct: 50 })
  // node:sqlite binds whole numbers as REAL, the case the CAST guards against.
  const rows = d.prepare(DAILY_CAPACITY_SQL).all('battery', 0, DAY)
  assert.deepEqual(
    rows.map((r) => r.kwh),
    [101, 102],
  )
})

test('stats points keep one point per bucket and drive', () => {
  const d = db()
  drive(d, 'd1', 0, null)
  const ins = d.prepare('INSERT INTO points (drive_id, ts, lat, lon) VALUES (?, ?, ?, ?)')
  for (const ts of [0, 5000, 14_000, 15_000, 20_000, 31_000]) ins.run('d1', ts, 1, 2)
  const rows = d.prepare(STATS_POINTS_SQL).all(0, 200, 15_000)
  assert.deepEqual(
    rows.map((r) => r.ts),
    [0, 15_000, 31_000],
  )
})

test('drive window samples dedupe overlapping windows and skip far samples', () => {
  const d = db()
  const hour = 3_600_000
  drive(d, 'a', 10 * hour, 11 * hour)
  drive(d, 'b', 11 * hour + 60_000, 12 * hour)
  for (const ts of [0, 10 * hour - 60_000, 11 * hour + 30_000, 30 * hour])
    sample(d, ts, { socPct: 50 })
  const rows = d
    .prepare(DRIVE_WINDOW_SAMPLES_SQL)
    .all('battery', 0, 30 * 60_000, DAY, 60_000, Number.MAX_SAFE_INTEGER)
  assert.deepEqual(
    rows.map((r) => r.ts),
    [10 * hour - 60_000, 11 * hour + 30_000],
  )
})

test('drive window samples stop at the upper bound', () => {
  const d = db()
  const hour = 3_600_000
  drive(d, 'a', 10 * hour, 11 * hour)
  drive(d, 'b', 20 * hour, 21 * hour)
  sample(d, 10 * hour, { socPct: 50 })
  sample(d, 20 * hour, { socPct: 40 })
  const rows = d
    .prepare(DRIVE_WINDOW_SAMPLES_SQL)
    .all('battery', 0, 30 * 60_000, DAY, 60_000, 15 * hour)
  assert.deepEqual(
    rows.map((r) => r.ts),
    [10 * hour],
  )
})

test('range points keep one point per bucket for drives in the range, short ones too', () => {
  const d = db()
  drive(d, 'd1', 0, null)
  drive(d, 'd2', 50_000, null)
  d.prepare('UPDATE drives SET distance_m = 50 WHERE id = ?').run('d2')
  drive(d, 'd3', 100_000, null)
  const ins = d.prepare('INSERT INTO points (drive_id, ts, lat, lon, alt) VALUES (?, ?, ?, ?, ?)')
  for (const ts of [0, 5000, 15_000]) ins.run('d1', ts, 1, 2, ts)
  ins.run('d2', 50_000, 1, 2, 7)
  ins.run('d3', 100_000, 1, 2, 9)
  const rows = d.prepare(RANGE_POINTS_SQL).all(0, 60_000, 15_000)
  assert.deepEqual(
    rows.map((r) => [r.drive_id, r.ts, r.alt]),
    [
      ['d1', 0, 0],
      ['d1', 15_000, 15_000],
      ['d2', 50_000, 7],
    ],
  )
})
