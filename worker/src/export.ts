// The drive payload shared with Roadbook, plus GeoJSON and GPX renderings. Pure, no I/O.
// Schema: docs/roadbook.md. Roadbook's `import_drive` tool accepts `DrivePayload` unchanged.

import type { PlaceInfo } from './geocode.ts'
import { type LonLat, simplifyIndices } from './simplify.ts'
import { type DriveEnergy, type Elevation, efficiencyKmPerKwh, round } from './stats.ts'
import { localIso, timezoneAt, utcIso } from './timezone.ts'

export const DRIVE_SCHEMA = 'roadbook.drive/1'
export const DRIVES_SCHEMA = 'roadbook.drives/1'
/** Fewer fixes per km than this marks a drive as sparse (older recordings log 5 to 25 points). */
export const SPARSE_POINTS_PER_KM = 3

export interface RoutePoint {
  ts: number
  lat: number
  lon: number
  alt: number | null
}

export interface EndPoint {
  lat: number
  lng: number
  /** Settlement-level label, never a street. Null when the geocoder knows nothing here. */
  label: string | null
  neighborhood: string | null
  city: string | null
  region: string | null
  country: string | null
  country_code: string | null
}

export interface DriveQuality {
  point_count: number
  points_per_km: number
  /** Too few fixes for a faithful route; the distance is still the odometer-grade sum. */
  sparse: boolean
  /** GPS drift while parked, not a drive. */
  noise: boolean
  /** False when no battery sample sits close enough to the drive to measure energy. */
  energy_measured: boolean
  notes: string[]
}

export interface DrivePayload {
  schema: typeof DRIVE_SCHEMA
  source: { system: 'rivian'; id: string; vehicle_id: string }
  started_at: string
  ended_at: string
  timezone: string | null
  started_at_local: string
  ended_at_local: string
  /** Only when the drive ends in another time zone. */
  end_timezone?: string
  distance_km: number
  duration_min: number
  max_speed_kmh: number
  elevation_gain_m: number | null
  elevation_loss_m: number | null
  energy_kwh: number | null
  efficiency_km_per_kwh: number | null
  start: EndPoint
  end: EndPoint
  route: { type: 'LineString'; coordinates: LonLat[] }
  quality: DriveQuality
}

export interface DriveFacts {
  id: string
  vehicleId: string
  startedAt: number
  endedAt: number
  startLat: number
  startLon: number
  endLat: number
  endLon: number
  distanceM: number
  maxSpeedMps: number
  pointCount: number
  noise: boolean
  energy: DriveEnergy | null
  elevation: Elevation | null
  start: PlaceInfo | null
  end: PlaceInfo | null
}

/** The payload for one drive. `points` is the full track; the route is simplified to `maxPoints`. */
export function drivePayload(
  d: DriveFacts,
  points: readonly RoutePoint[],
  maxPoints: number,
): DrivePayload {
  const timezone = timezoneAt(d.startLat, d.startLon)
  const endTimezone = timezoneAt(d.endLat, d.endLon)
  const coords = points.map((p): LonLat => [round(p.lon, 6), round(p.lat, 6)])
  const route = simplifyIndices(coords, maxPoints).map((i) => coords[i])
  const distanceKm = d.distanceM / 1000
  const notes: string[] = []
  if (d.noise) notes.push('GPS noise while parked, not a drive.')
  const sparse = distanceKm > 0 && d.pointCount / distanceKm < SPARSE_POINTS_PER_KM
  if (sparse) notes.push('Few GPS fixes for the distance; the route is coarse.')
  if (!d.energy) notes.push('No battery sample close enough to the drive; energy is unknown.')
  if (!d.elevation) notes.push('No altitude data; elevation is unknown.')
  return {
    schema: DRIVE_SCHEMA,
    source: { system: 'rivian', id: d.id, vehicle_id: d.vehicleId },
    started_at: utcIso(d.startedAt),
    ended_at: utcIso(d.endedAt),
    timezone,
    started_at_local: localIso(d.startedAt, timezone),
    ended_at_local: localIso(d.endedAt, endTimezone ?? timezone),
    ...(endTimezone && endTimezone !== timezone ? { end_timezone: endTimezone } : {}),
    distance_km: round(distanceKm, 2),
    duration_min: Math.round((d.endedAt - d.startedAt) / 60_000),
    max_speed_kmh: Math.round(d.maxSpeedMps * 3.6),
    elevation_gain_m: d.elevation ? Math.round(d.elevation.gainM) : null,
    elevation_loss_m: d.elevation ? Math.round(d.elevation.lossM) : null,
    energy_kwh: d.energy?.energyKwh ?? null,
    efficiency_km_per_kwh: efficiencyKmPerKwh(d.distanceM, d.energy?.energyKwh ?? null),
    start: endPoint(d.startLat, d.startLon, d.start),
    end: endPoint(d.endLat, d.endLon, d.end),
    route: { type: 'LineString', coordinates: route },
    quality: {
      point_count: d.pointCount,
      points_per_km: distanceKm > 0 ? round(d.pointCount / distanceKm, 1) : 0,
      sparse,
      noise: d.noise,
      energy_measured: d.energy !== null,
      notes,
    },
  }
}

function endPoint(lat: number, lon: number, place: PlaceInfo | null): EndPoint {
  return {
    lat: round(lat, 6),
    lng: round(lon, 6),
    label: place?.label ?? null,
    neighborhood: place?.neighborhood ?? null,
    city: place?.city ?? null,
    region: place?.region ?? null,
    country: place?.country ?? null,
    country_code: place?.countryCode ?? null,
  }
}

/** A GeoJSON Feature: the route as geometry, everything else as properties. */
export function toGeoJsonFeature(payload: DrivePayload) {
  const { route, ...properties } = payload
  return { type: 'Feature' as const, properties, geometry: route }
}

export function toGeoJsonCollection(payloads: readonly DrivePayload[]) {
  return { type: 'FeatureCollection' as const, features: payloads.map(toGeoJsonFeature) }
}

/** GPX 1.1 with one track per drive, simplified to `maxPoints` and keeping time and elevation. */
export function toGpx(
  drives: readonly { payload: DrivePayload; points: readonly RoutePoint[] }[],
  maxPoints: number,
): string {
  const tracks = drives.map(({ payload, points }) => {
    const coords = points.map((p): LonLat => [p.lon, p.lat])
    const kept = simplifyIndices(coords, maxPoints).map((i) => points[i])
    const name = xml(`${payload.start.label ?? 'Start'} to ${payload.end.label ?? 'End'}`)
    const segment = kept
      .map((p) => {
        const ele = p.alt === null ? '' : `<ele>${round(p.alt, 1)}</ele>`
        return `      <trkpt lat="${round(p.lat, 6)}" lon="${round(p.lon, 6)}">${ele}<time>${utcIso(p.ts)}</time></trkpt>`
      })
      .join('\n')
    return [
      '  <trk>',
      `    <name>${name}</name>`,
      `    <desc>${xml(`${payload.started_at_local}, ${payload.distance_km} km, ${payload.duration_min} min`)}</desc>`,
      `    <src>rivian:${xml(payload.source.id)}</src>`,
      '    <trkseg>',
      segment,
      '    </trkseg>',
      '  </trk>',
    ].join('\n')
  })
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="rivian-mcp" xmlns="http://www.topografix.com/GPX/1/1">',
    ...tracks,
    '</gpx>',
  ].join('\n')
}

function xml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`)
}
