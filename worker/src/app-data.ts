// structuredContent shapes the app tools return and the view renders. Types only.
// All values are SI: meters, m/s, kWh, Unix epoch ms. The view converts units.

import type { Elevation } from './stats.ts'

/** [ts, lat, lon, alt m, speed m/s] */
export type TrackPoint = [number, number, number, number | null, number | null]
/** [lat, lon] */
export type RoutePoint = [number, number]
/** [ts, value] */
export type Series = [number, number][]

export interface DriveSummary {
  id: string
  vehicleId: string
  startedAt: number
  endedAt: number | null
  distanceM: number
  maxSpeedMps: number
  energyKwh: number | null
  efficiencyKmPerKwh: number | null
  gainM: number | null
  lossM: number | null
}

export interface DriveView {
  kind: 'drive'
  drive: DriveSummary & {
    durationMs: number
    startOdometerKm: number | null
    endOdometerKm: number | null
    socStartPct: number | null
    socEndPct: number | null
    elevation: Elevation | null
  }
  track: TrackPoint[]
}

export interface StatsView {
  kind: 'stats'
  from: number
  to: number
  /** Drives shorter than minDriveM or slower than minAvgSpeedMps were left out as GPS noise. */
  minDriveM: number
  minAvgSpeedMps: number
  skipped: number
  drives: (DriveSummary & { route: RoutePoint[] })[]
  /** Pack capacity over time, one sample per day. */
  capacity: Series
}

export interface ChargeSessionView {
  vehicleId: string
  startedAt: number
  endedAt: number
  socStartPct: number
  socEndPct: number
  energyKwh: number
  avgKw: number
  /** Highest reported charging power. The field number is not confirmed live. */
  peakKw: number | null
  soc: Series
  power: Series
}

export interface ChargingView {
  kind: 'charging'
  from: number
  to: number
  sessions: ChargeSessionView[]
}

export type AppView = DriveView | StatsView | ChargingView
