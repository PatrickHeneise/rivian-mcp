import assert from 'node:assert/strict'
import { test } from 'node:test'
import { type DriveFacts, drivePayload, toGeoJsonFeature, toGpx } from '../src/export.ts'
import { BOULDER, BOULDER_START_MS, boulderToLongmont, LONGMONT } from './support/d1.ts'

const points = boulderToLongmont()

const facts = (over: Partial<DriveFacts> = {}): DriveFacts => ({
  id: 'd-boulder',
  vehicleId: 'v1',
  startedAt: BOULDER_START_MS,
  endedAt: points.at(-1)?.ts ?? BOULDER_START_MS,
  startLat: BOULDER.lat,
  startLon: BOULDER.lon,
  endLat: LONGMONT.lat,
  endLon: LONGMONT.lon,
  distanceM: 24_310,
  maxSpeedMps: 29.1,
  pointCount: points.length,
  noise: false,
  energy: { socStartPct: 71, socEndPct: 67, energyKwh: 5.69 },
  elevation: { gainM: 48.2, lossM: 190.7, minM: 1500, maxM: 1680 },
  start: {
    label: 'Table Mesa, Boulder, Colorado',
    neighborhood: 'Table Mesa',
    city: 'Boulder',
    region: 'Colorado',
    country: 'United States',
    countryCode: 'US',
  },
  end: {
    label: 'Longmont, Colorado',
    neighborhood: null,
    city: 'Longmont',
    region: 'Colorado',
    country: 'United States',
    countryCode: 'US',
  },
  ...over,
})

test('drivePayload renders the Boulder to Longmont drive for Roadbook', () => {
  const p = drivePayload(facts(), points, 100)
  assert.equal(p.schema, 'roadbook.drive/1')
  assert.deepEqual(p.source, { system: 'rivian', id: 'd-boulder', vehicle_id: 'v1' })
  assert.equal(p.started_at, '2026-10-13T20:04:11Z')
  assert.equal(p.timezone, 'America/Denver')
  assert.equal(p.started_at_local, '2026-10-13T14:04:11-06:00')
  assert.equal(p.ended_at_local, '2026-10-13T14:38:05-06:00')
  assert.equal('end_timezone' in p, false)
  assert.equal(p.distance_km, 24.31)
  assert.equal(p.duration_min, 34)
  assert.equal(p.max_speed_kmh, 105)
  assert.equal(p.elevation_gain_m, 48)
  assert.equal(p.elevation_loss_m, 191)
  assert.equal(p.energy_kwh, 5.69)
  assert.equal(p.efficiency_km_per_kwh, 4.27)
  assert.equal(p.start.label, 'Table Mesa, Boulder, Colorado')
  assert.equal(p.start.lat, 40.0539)
  assert.equal(p.start.lng, -105.2845)
  assert.equal(p.end.city, 'Longmont')
  assert.equal(p.route.type, 'LineString')
  assert.ok(p.route.coordinates.length <= 100)
  assert.ok(p.route.coordinates.length > 20)
  assert.deepEqual(p.route.coordinates[0], [-105.2845, 40.0539])
  assert.deepEqual(p.route.coordinates.at(-1), [LONGMONT.lon, LONGMONT.lat])
  assert.deepEqual(p.quality, {
    point_count: 227,
    points_per_km: 9.3,
    sparse: false,
    noise: false,
    energy_measured: true,
    notes: [],
  })
})

test('drivePayload says what is missing', () => {
  const p = drivePayload(facts({ energy: null, elevation: null, pointCount: 12 }), points, 100)
  assert.equal(p.energy_kwh, null)
  assert.equal(p.efficiency_km_per_kwh, null)
  assert.equal(p.elevation_gain_m, null)
  assert.equal(p.quality.energy_measured, false)
  assert.equal(p.quality.sparse, true)
  assert.equal(p.quality.points_per_km, 0.5)
  assert.deepEqual(p.quality.notes, [
    'Few GPS fixes for the distance; the route is coarse.',
    'No battery sample close enough to the drive; energy is unknown.',
    'No altitude data; elevation is unknown.',
  ])
  const junk = drivePayload(
    facts({
      distanceM: 90,
      pointCount: 1,
      noise: true,
      endLat: BOULDER.lat,
      endLon: BOULDER.lon,
    }),
    points.slice(0, 1),
    100,
  )
  assert.equal(junk.quality.noise, true)
  assert.equal(junk.quality.notes[0], 'GPS noise while parked, not a drive.')
  assert.equal(junk.route.coordinates.length, 1)
})

test('drivePayload notes a drive that ends in another zone', () => {
  const p = drivePayload(facts({ endLat: 39.1, endLon: -108.9, end: null }), points, 50)
  assert.equal(p.end_timezone, undefined)
  const crossing = drivePayload(facts({ endLat: 36.1, endLon: -115.2, end: null }), points, 50)
  assert.equal(crossing.timezone, 'America/Denver')
  assert.equal(crossing.end_timezone, 'America/Los_Angeles')
  assert.ok(crossing.ended_at_local.endsWith('-07:00'))
  assert.equal(crossing.end.label, null)
})

test('toGeoJsonFeature moves the route into the geometry', () => {
  const p = drivePayload(facts(), points, 30)
  const f = toGeoJsonFeature(p)
  assert.equal(f.type, 'Feature')
  assert.equal(f.geometry, p.route)
  assert.equal('route' in f.properties, false)
  assert.equal(f.properties.source.id, 'd-boulder')
})

test('toGpx writes one simplified track with time and elevation', () => {
  const start = facts().start
  const p = drivePayload(facts({ start: start && { ...start, label: 'A & B <Town>' } }), points, 30)
  const gpx = toGpx([{ payload: p, points }], 30)
  const trkpts = gpx.match(/<trkpt /g) ?? []
  assert.ok(trkpts.length <= 30 && trkpts.length >= 10, `${trkpts.length} points`)
  assert.ok(gpx.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1"'))
  assert.ok(gpx.includes('<time>2026-10-13T20:04:11Z</time>'))
  assert.ok(gpx.includes('<ele>1655</ele>'))
  assert.ok(gpx.includes('<name>A &#38; B &#60;Town&#62; to Longmont, Colorado</name>'))
  assert.ok(gpx.includes('<src>rivian:d-boulder</src>'))
})

test('drivePayload route starts at the drive start and ends at the drive end', () => {
  const inner = points.slice(5, 20)
  const p = drivePayload(facts(), inner, 100)
  const coords = p.route.coordinates
  assert.deepEqual(coords[0], [p.start.lng, p.start.lat])
  assert.deepEqual(coords.at(-1), [p.end.lng, p.end.lat])
  const tiny = drivePayload(facts(), inner, 2)
  assert.equal(tiny.route.coordinates.length, 2)
  assert.deepEqual(tiny.route.coordinates[0], [p.start.lng, p.start.lat])
  assert.deepEqual(tiny.route.coordinates[1], [p.end.lng, p.end.lat])
})
