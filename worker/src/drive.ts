// Drive detection from a stream of GPS points. Pure functions, no I/O.

import type { Gnss, PowerState } from './parallax.ts'

/** Store at most one point per interval while driving. */
export const STORE_INTERVAL_MS = 5_000
/**
 * The vehicle counts as moving once it is this far from where it last moved, or from where
 * it parked. Position, not speed: a parked 2025 R1S on a charger reports 2.0-2.4 m in GNSS
 * field 6, the horizontal position error, which the decoder once read as speed (2026-10-10).
 */
export const MOVE_DISTANCE_M = 25
/** A drive ends after this long without moving, as in RivianMate. */
export const PARK_GRACE_MS = 3 * 60_000

export interface Point extends Gnss {
  ts: number
}

export interface Drive {
  id: string
  vehicleId: string
  startedAt: number
  endedAt: number | null
  startLat: number
  startLon: number
  endLat: number
  endLon: number
  startOdometerKm: number | null
  endOdometerKm: number | null
  distanceM: number
  maxSpeedMps: number
  pointCount: number
  lastStoredAt: number
  lastMovingAt: number
  /** Position at lastMovingAt. Missing on drives stored before 2026-10-10. */
  movingLat?: number
  movingLon?: number
}

/**
 * Feeds one GPS point into the vehicle's open drive, or opens one.
 * `parkedAt` is the first point seen while parked; a drive opens once the vehicle is
 * MOVE_DISTANCE_M away from it. Returns the drive (or null when parked), the parked
 * position and the point to store, if any.
 */
export function onPoint(
  drive: Drive | null,
  parkedAt: Point | null,
  vehicleId: string,
  point: Point,
  odometerKm: number | null,
): { drive: Drive | null; parkedAt: Point | null; stored: Point | null } {
  const speed = point.speedMps ?? 0
  if (!drive) {
    if (!parkedAt) return { drive: null, parkedAt: point, stored: null }
    const moved = distanceM(parkedAt.lat, parkedAt.lon, point.lat, point.lon)
    if (moved < MOVE_DISTANCE_M) return { drive: null, parkedAt, stored: null }
    return {
      drive: {
        id: `${vehicleId}-${point.ts}`,
        vehicleId,
        startedAt: point.ts,
        endedAt: null,
        startLat: parkedAt.lat,
        startLon: parkedAt.lon,
        endLat: point.lat,
        endLon: point.lon,
        startOdometerKm: odometerKm,
        endOdometerKm: odometerKm,
        distanceM: moved,
        maxSpeedMps: speed,
        pointCount: 1,
        lastStoredAt: point.ts,
        lastMovingAt: point.ts,
        movingLat: point.lat,
        movingLon: point.lon,
      },
      parkedAt: null,
      stored: point,
    }
  }

  const next = { ...drive }
  // Drives stored before 2026-10-10 have no moving position: anchor it at the last stored point.
  next.movingLat ??= next.endLat
  next.movingLon ??= next.endLon
  if (distanceM(next.movingLat, next.movingLon, point.lat, point.lon) >= MOVE_DISTANCE_M) {
    next.lastMovingAt = Math.max(next.lastMovingAt, point.ts)
    next.movingLat = point.lat
    next.movingLon = point.lon
  }
  if (point.ts - drive.lastStoredAt < STORE_INTERVAL_MS) {
    return { drive: next, parkedAt: null, stored: null }
  }

  next.distanceM += distanceM(drive.endLat, drive.endLon, point.lat, point.lon)
  next.endLat = point.lat
  next.endLon = point.lon
  next.maxSpeedMps = Math.max(next.maxSpeedMps, speed)
  next.pointCount += 1
  next.lastStoredAt = point.ts
  if (odometerKm !== null) next.endOdometerKm = odometerKm
  return { drive: next, parkedAt: null, stored: point }
}

/** Rivian replays older samples on subscribe. They must not replace the latest point. */
export function isOlderPoint(last: Point | null, point: Point): boolean {
  return last !== null && point.ts < last.ts
}

/**
 * The parked position is stale after a gap in GPS points (asleep, tow, ferry): the next
 * point becomes the new one. Returns null in that case, else `parkedAt` unchanged.
 */
export function parkedAfterGap(
  parkedAt: Point | null,
  last: Point | null,
  point: Point,
): Point | null {
  return last && point.ts - last.ts > PARK_GRACE_MS ? null : parkedAt
}

/** A drive ends when the vehicle powers down or has not moved for PARK_GRACE_MS. */
export function shouldClose(drive: Drive, now: number, power: PowerState | null): boolean {
  return power === 'sleep' || power === 'standby' || now - drive.lastMovingAt > PARK_GRACE_MS
}

/**
 * Ends the drive where it last moved, not at the last stored point: the points stored during
 * PARK_GRACE_MS are parked and would add minutes to every drive.
 */
export function close(drive: Drive, odometerKm: number | null): Drive {
  return {
    ...drive,
    endedAt: drive.lastMovingAt,
    endLat: drive.movingLat ?? drive.endLat,
    endLon: drive.movingLon ?? drive.endLon,
    endOdometerKm: odometerKm ?? drive.endOdometerKm,
  }
}

/** Haversine distance in meters. */
export function distanceM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180
  const dLat = (lat2 - lat1) * rad
  const dLon = (lon2 - lon1) * rad
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2
  return 2 * 6_371_000 * Math.asin(Math.sqrt(a))
}
