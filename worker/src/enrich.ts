// Loads what the drive tools report beyond the drives row: place labels, energy, elevation.

import { batterySamples, DAY_MS, driveWindowSamples } from './battery.ts'
import type { DriveFacts, RoutePoint } from './export.ts'
import { type Fetch, geocodeKey, type PlaceInfo, reverseGeocodeMany } from './geocode.ts'
import { RANGE_POINTS_SQL } from './queries.ts'
import { driveEnergy, elevation, isNoise } from './stats.ts'

/** Altitude for the drive list comes from one point per this window. */
const LIST_POINT_BUCKET_MS = 15_000

export interface DriveRow {
  id: string
  vehicle_id: string
  started_at: number
  ended_at: number | null
  start_lat: number
  start_lon: number
  end_lat: number
  end_lon: number
  start_odometer_km: number | null
  end_odometer_km: number | null
  distance_m: number
  max_speed_mps: number
  point_count: number
}

export interface EnrichOptions {
  /** Skip the geocoder (tests, or a host without network egress). */
  geocode?: boolean
  fetchImpl?: Fetch
}

/**
 * Facts for several drives with one query each for altitude, battery and geocodes, so a list
 * of 100 drives does not fan out into 300 lookups.
 */
export async function enrichDrives(
  db: D1Database,
  rows: readonly DriveRow[],
  options: EnrichOptions = {},
): Promise<DriveFacts[]> {
  if (rows.length === 0) return []
  const from = Math.min(...rows.map((r) => r.started_at))
  const to = Math.max(...rows.map((r) => r.started_at))
  const { results: points } = await db
    .prepare(RANGE_POINTS_SQL)
    .bind(from, to, LIST_POINT_BUCKET_MS)
    .all<{ drive_id: string; ts: number; alt: number | null }>()
  const pointsByDrive = Map.groupBy(points, (p) => p.drive_id)
  const samples = await driveWindowSamples(db, from, to)
  const places = await geocodeRows(db, rows, options)
  return rows.map((row) => {
    const track = pointsByDrive.get(row.id) ?? []
    const endedAt = row.ended_at ?? track.at(-1)?.ts ?? row.started_at
    return facts(row, endedAt, places, {
      energy: driveEnergy(samples.get(row.vehicle_id) ?? [], row.started_at, endedAt),
      elevation: elevation(track.map((p) => p.alt)),
    })
  })
}

/** Facts for one drive from its full track, which the caller needs anyway for the route. */
export async function enrichDrive(
  db: D1Database,
  row: DriveRow,
  points: readonly RoutePoint[],
  options: EnrichOptions = {},
): Promise<DriveFacts> {
  const endedAt = row.ended_at ?? points.at(-1)?.ts ?? row.started_at
  const samples = await batterySamples(
    db,
    row.vehicle_id,
    row.started_at - DAY_MS,
    endedAt + DAY_MS,
  )
  const places = await geocodeRows(db, [row], options)
  return facts(row, endedAt, places, {
    energy: driveEnergy(samples, row.started_at, endedAt),
    elevation: elevation(points.map((p) => p.alt)),
  })
}

export async function loadPoints(db: D1Database, driveId: string): Promise<RoutePoint[]> {
  const { results } = await db
    .prepare('SELECT ts, lat, lon, alt FROM points WHERE drive_id = ? ORDER BY ts')
    .bind(driveId)
    .all<RoutePoint>()
  return results
}

async function geocodeRows(
  db: D1Database,
  rows: readonly DriveRow[],
  options: EnrichOptions,
): Promise<Map<string, PlaceInfo | null>> {
  if (options.geocode === false) return new Map()
  const coords = rows.flatMap((r) => [
    { lat: r.start_lat, lon: r.start_lon },
    { lat: r.end_lat, lon: r.end_lon },
  ])
  return reverseGeocodeMany(db, coords, options.fetchImpl)
}

function facts(
  row: DriveRow,
  endedAt: number,
  places: Map<string, PlaceInfo | null>,
  rest: Pick<DriveFacts, 'energy' | 'elevation'>,
): DriveFacts {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    startedAt: row.started_at,
    endedAt,
    startLat: row.start_lat,
    startLon: row.start_lon,
    endLat: row.end_lat,
    endLon: row.end_lon,
    distanceM: row.distance_m,
    maxSpeedMps: row.max_speed_mps,
    pointCount: row.point_count,
    noise: isNoise(row.distance_m, row.ended_at === null ? null : endedAt - row.started_at),
    start: places.get(geocodeKey(row.start_lat, row.start_lon)) ?? null,
    end: places.get(geocodeKey(row.end_lat, row.end_lon)) ?? null,
    ...rest,
  }
}
