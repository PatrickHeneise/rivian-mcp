// Live GPS from the legacy vehicleState subscription. Pure functions, no I/O.
// Rivian sends an update every 3-7 s; gnssLocation is null in most updates while parked
// (read-only probe, 2026-10-11). Its gnssError values equal parallax GNSS fields 6 and 8,
// so the values are SI: speed in m/s, altitude in m.

import type { Point } from './drive.ts'

export const VEHICLE_STATE_SUBSCRIPTION = `subscription VehicleState($vehicleID: String!) {
  vehicleState(id: $vehicleID) {
    gnssLocation { latitude longitude timeStamp isAuthorized }
    gnssSpeed { timeStamp value }
    gnssBearing { timeStamp value }
    gnssAltitude { timeStamp value }
  }
}`

/** Subscription ids for vehicleState are this prefix plus the vehicle id. */
export const STATE_ID_PREFIX = 'state:'

interface Timed {
  timeStamp: string
  value: number | null
}

export interface VehicleStateData {
  gnssLocation?: {
    latitude: number | null
    longitude: number | null
    timeStamp: string
    isAuthorized?: boolean | null
  } | null
  gnssSpeed?: Timed | null
  gnssBearing?: Timed | null
  gnssAltitude?: Timed | null
}

/**
 * The GPS fix of one update, or null without a location. Speed, bearing and altitude are
 * kept only when they carry the location's timestamp, so a stale value never joins a new fix.
 */
export function pointFromVehicleState(data: VehicleStateData | null | undefined): Point | null {
  const loc = data?.gnssLocation
  if (!loc || loc.isAuthorized === false) return null
  if (typeof loc.latitude !== 'number' || typeof loc.longitude !== 'number') return null
  const ts = Date.parse(loc.timeStamp)
  if (!Number.isFinite(ts)) return null
  const at = (t: Timed | null | undefined) =>
    t && t.timeStamp === loc.timeStamp && typeof t.value === 'number' ? t.value : null
  const bearing = at(data.gnssBearing)
  return {
    ts,
    lat: loc.latitude,
    lon: loc.longitude,
    alt: at(data.gnssAltitude),
    speedMps: at(data.gnssSpeed),
    bearing: bearing === null ? null : ((bearing % 360) + 360) % 360,
  }
}
