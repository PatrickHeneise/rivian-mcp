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
  /** Pack capacity over time, one sample per day for each vehicle. */
  capacity: { vehicleId: string; points: Series }[]
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

export type Corner = 'fl' | 'fr' | 'rl' | 'rr'
/** The silhouette the view draws. Models without their own drawing use the closest one. */
export type BodyShape = 'R1S' | 'R1T' | 'R2'

/** A door or closure. Null fields had no signal. */
export interface Opening {
  open: boolean | null
  locked: boolean | null
}

export type ClosureId =
  | 'frunk'
  | 'liftgate'
  | 'tailgate'
  | 'tonneau'
  | 'sideBinLeft'
  | 'sideBinRight'

export interface ClosureStatus extends Opening {
  id: ClosureId
  label: string
}

export type TireStatus = 'ok' | 'low' | 'critical' | null

export interface Alert {
  level: 'critical' | 'warning' | 'info'
  text: string
}

export type Activity = 'driving' | 'charging' | 'parked' | 'asleep'

export type ChargeState = 'unplugged' | 'plugged' | 'charging' | 'complete'

export interface StatusView {
  kind: 'status'
  /** When the state was read. */
  at: number
  vehicle: {
    id: string
    name: string | null
    model: string
    modelYear: number | null
    shape: BodyShape
  }
  activity: Activity
  online: boolean | null
  lastSyncAt: number | null
  /** `sleep`, `ready` or `go`. */
  powerState: string | null
  gear: string | null
  driveMode: string | null
  /** The drive the recorder has open. */
  drive: { startedAt: number; distanceM: number } | null
  battery: {
    socPct: number | null
    limitPct: number | null
    /** Range in meters. Null when its unit is unknown; rangeRaw still has the number. */
    rangeM: number | null
    /** distanceToEmpty as sent, in the vehicle's distance unit. */
    rangeRaw: number | null
    capacityKwh: number | null
    low: boolean
  }
  charging: {
    state: ChargeState | null
    minutesToFull: number | null
    /** Last recorded charging power in the past few minutes. The field number is not confirmed. */
    powerKw: number | null
    disabled: boolean
  }
  /** All doors and closures with a lock signal report locked. Null without any lock signal. */
  locked: boolean | null
  doors: Record<Corner, Opening>
  /** True when open. */
  windows: Record<Corner, boolean | null>
  /** Only closures this vehicle reports. */
  closures: ClosureStatus[]
  tires: Record<Corner, TireStatus>
  gearGuardLocked: boolean | null
  cabin: {
    tempC: number | null
    setpointC: number | null
    preconditioning: boolean
    petMode: boolean
    defrost: boolean
  }
  odometerM: number | null
  /** The place label is settlement level: never a street or house number. */
  location: { lat: number; lon: number; place: string | null } | null
  software: {
    current: string | null
    available: string | null
    /** Readable OTA status, such as `Up to date` or `Ready to install`. */
    status: string | null
    downloadPct: number | null
    installPct: number | null
    installDurationMin: number | null
    currentNotesUrl: string | null
    availableNotesUrl: string | null
  }
  alerts: Alert[]
}

export type AppView = DriveView | StatsView | ChargingView | StatusView
