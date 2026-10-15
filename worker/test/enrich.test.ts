import assert from 'node:assert/strict'
import { test } from 'node:test'
import { type DriveRow, enrichDrive, enrichDrives, loadPoints } from '../src/enrich.ts'
import { drivePayload } from '../src/export.ts'
import { describeDrive } from '../src/mcp.ts'
import { RVM_BATTERY } from '../src/parallax.ts'
import { BOULDER, BOULDER_START_MS, boulderToLongmont, fakeD1, LONGMONT } from './support/d1.ts'
import './support/cloudflare-stub.ts'

const PACK = 142.21

function seed() {
  const { db, sqlite } = fakeD1()
  const points = boulderToLongmont()
  const endedAt = points.at(-1)?.ts as number
  sqlite
    .prepare(
      `INSERT INTO drives (id, vehicle_id, started_at, ended_at, start_lat, start_lon, end_lat, end_lon, distance_m, max_speed_mps, point_count)
VALUES (?, 'v1', ?, ?, ?, ?, ?, ?, 24310, 29.1, ?)`,
    )
    .run(
      'd1',
      BOULDER_START_MS,
      endedAt,
      BOULDER.lat,
      BOULDER.lon,
      LONGMONT.lat,
      LONGMONT.lon,
      points.length,
    )
  const ins = sqlite.prepare(
    'INSERT INTO points (drive_id, ts, lat, lon, alt) VALUES (?, ?, ?, ?, ?)',
  )
  for (const p of points) ins.run('d1', p.ts, p.lat, p.lon, p.alt)
  // A 90 m blip with one point: parked GPS drift.
  sqlite
    .prepare(
      `INSERT INTO drives (id, vehicle_id, started_at, ended_at, start_lat, start_lon, end_lat, end_lon, distance_m, max_speed_mps, point_count)
VALUES ('junk', 'v1', ?, ?, ?, ?, ?, ?, 90, 0.4, 1)`,
    )
    .run(
      endedAt + 3_600_000,
      endedAt + 3_660_000,
      LONGMONT.lat,
      LONGMONT.lon,
      LONGMONT.lat,
      LONGMONT.lon,
    )
  const sample = sqlite.prepare("INSERT INTO charge_samples VALUES ('v1', ?, ?, ?, '')")
  sample.run(
    BOULDER_START_MS - 120_000,
    RVM_BATTERY,
    JSON.stringify({ socPct: 71, packEnergyKwh: PACK }),
  )
  sample.run(endedAt + 30_000, RVM_BATTERY, JSON.stringify({ socPct: 67, packEnergyKwh: PACK }))
  return { db, sqlite, points, endedAt }
}

const photonFor = (lat: string) =>
  lat === '40.054'
    ? {
        features: [
          {
            properties: {
              osm_key: 'building',
              osm_value: 'house',
              street: 'Table Mesa Dr',
              district: 'Table Mesa',
              city: 'Boulder',
              state: 'Colorado',
              country: 'United States',
              countrycode: 'us',
            },
          },
        ],
      }
    : {
        features: [
          {
            properties: {
              osm_key: 'place',
              osm_value: 'city',
              name: 'Longmont',
              state: 'Colorado',
              country: 'United States',
              countrycode: 'us',
            },
          },
        ],
      }

const fetchImpl = async (url: string) =>
  Response.json(photonFor(new URL(url).searchParams.get('lat') ?? ''))

test('enrichDrives adds elevation, energy, noise and places in one pass', async () => {
  const { db, sqlite } = seed()
  const rows = sqlite
    .prepare('SELECT * FROM drives ORDER BY started_at')
    .all() as unknown as DriveRow[]
  const [drive, junk] = await enrichDrives(db, rows, { fetchImpl })
  assert.equal(drive.energy?.energyKwh, 5.69)
  assert.ok(drive.elevation && drive.elevation.lossM > 100)
  assert.equal(drive.noise, false)
  assert.equal(drive.start?.label, 'Table Mesa, Boulder, Colorado')
  assert.equal(drive.end?.label, 'Longmont, Colorado')
  assert.equal(junk.noise, true)
  assert.equal(junk.start?.label, 'Longmont, Colorado')
  const text = describeDrive(drive, false)
  assert.match(text, /Table Mesa, Boulder, Colorado -> Longmont, Colorado/)
  assert.match(text, /2026-10-13 14:04 -> 14:38 MDT \(34 min\)/)
  assert.match(text, /24\.3 km, max 105 km\/h, \+\d+ m \/ -\d+ m, 5\.69 kWh \(SoC 71% -> 67%\)/)
  assert.match(text, /227 points \(9\.3\/km\)$/)
  assert.match(describeDrive(junk, false), /NOISE: parked GPS drift/)
})

test('enrichDrive plus drivePayload replays the brief end to end', async () => {
  const { db, sqlite } = seed()
  const row = sqlite.prepare("SELECT * FROM drives WHERE id = 'd1'").get() as unknown as DriveRow
  const points = await loadPoints(db, 'd1')
  assert.equal(points.length, 227)
  const facts = await enrichDrive(db, row, points, { fetchImpl })
  const payload = drivePayload(facts, points, 100)
  assert.equal(payload.start.label, 'Table Mesa, Boulder, Colorado')
  assert.equal(payload.end.label, 'Longmont, Colorado')
  assert.equal(payload.energy_kwh, 5.69)
  assert.equal(payload.timezone, 'America/Denver')
  assert.ok(payload.route.coordinates.length <= 100)
  assert.equal(payload.quality.sparse, false)
  // Without the geocoder the payload still carries coordinates, only labels are null.
  const offline = drivePayload(await enrichDrive(db, row, points, { geocode: false }), points, 100)
  assert.equal(offline.start.label, null)
  assert.equal(offline.start.lat, 40.0539)
})
