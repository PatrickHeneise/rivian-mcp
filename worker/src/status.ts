// The vehicle status dashboard: live vehicle state to the show_status payload and its text.
// Pure functions, no I/O. Value strings are from .claude/skills/references/vehicle-state-properties.md.

import type {
  OtaStatus,
  StateValue,
  UserSettings,
  Vehicle,
  VehicleState,
} from '../../src/rivian-api.ts'
import type {
  Activity,
  Alert,
  BodyShape,
  ChargeState,
  ClosureId,
  ClosureStatus,
  Corner,
  Opening,
  StatusView,
  TireStatus,
} from './app-data.ts'

export const STATUS_PROPERTIES = new Set([
  'cloudConnection',
  'gnssLocation',
  'powerState',
  'gearStatus',
  'driveMode',
  'batteryLevel',
  'batteryLimit',
  'batteryCapacity',
  'batteryNeedsLfpCalibration',
  'distanceToEmpty',
  'vehicleMileage',
  'rangeThreshold',
  'timeToEndOfCharge',
  'chargingTimeEstimationValidity',
  'chargerStatus',
  'chargerState',
  'chargingDisabledAC',
  'chargingDisabledAll',
  'doorFrontLeftClosed',
  'doorFrontRightClosed',
  'doorRearLeftClosed',
  'doorRearRightClosed',
  'doorFrontLeftLocked',
  'doorFrontRightLocked',
  'doorRearLeftLocked',
  'doorRearRightLocked',
  'closureFrunkClosed',
  'closureFrunkLocked',
  'closureLiftgateClosed',
  'closureLiftgateLocked',
  'closureTailgateClosed',
  'closureTailgateLocked',
  'closureTonneauClosed',
  'closureTonneauLocked',
  'closureSideBinLeftClosed',
  'closureSideBinLeftLocked',
  'closureSideBinRightClosed',
  'closureSideBinRightLocked',
  'windowFrontLeftClosed',
  'windowFrontRightClosed',
  'windowRearLeftClosed',
  'windowRearRightClosed',
  'tirePressureStatusFrontLeft',
  'tirePressureStatusFrontRight',
  'tirePressureStatusRearLeft',
  'tirePressureStatusRearRight',
  'cabinClimateInteriorTemperature',
  'cabinClimateDriverTemperature',
  'cabinPreconditioningStatus',
  'defrostDefogStatus',
  'petModeStatus',
  'gearGuardLocked',
  'alarmSoundStatus',
  'otaCurrentVersion',
  'otaAvailableVersion',
  'otaStatus',
  'otaDownloadProgress',
  'otaInstallProgress',
  'otaInstallDuration',
  'batteryHvThermalEvent',
  'twelveVoltBatteryHealth',
  'wiperFluidState',
  'brakeFluidLow',
  'limitedAccelCold',
  'limitedRegenCold',
  'serviceMode',
  'carWashMode',
  'btmOcHardwareFailureStatus',
])

/** A recorder battery sample: parallax `energy.high_voltage.battery_state`. */
export interface ParallaxBattery {
  socPct: number
  rangeKm: number
}

export interface StatusInput {
  at: number
  vehicle: Vehicle
  state: VehicleState
  ota: OtaStatus | null
  settings: UserSettings | null
  /** Latest recorded battery sample, to tell the range unit when the settings do not. */
  parallaxBattery: ParallaxBattery | null
  powerKw: number | null
  drive: { startedAt: number; distanceM: number } | null
  place: string | null
}

const M_PER_MI = 1609.344
const CORNERS: [Corner, string, string][] = [
  ['fl', 'FrontLeft', 'front left'],
  ['fr', 'FrontRight', 'front right'],
  ['rl', 'RearLeft', 'rear left'],
  ['rr', 'RearRight', 'rear right'],
]
const CLOSURES: [ClosureId, string, string][] = [
  ['frunk', 'Frunk', 'Frunk'],
  ['liftgate', 'Liftgate', 'Liftgate'],
  ['tailgate', 'Tailgate', 'Tailgate'],
  ['tonneau', 'Tonneau', 'Tonneau cover'],
  ['sideBinLeft', 'SideBinLeft', 'Gear tunnel left'],
  ['sideBinRight', 'SideBinRight', 'Gear tunnel right'],
]

export function bodyShape(model: string): BodyShape {
  const m = model.toUpperCase()
  if (m.includes('R1T')) return 'R1T'
  if (m.includes('R2') || m.includes('R3')) return 'R2'
  return 'R1S'
}

/**
 * Range in meters. The API sends distanceToEmpty in the in-vehicle unit without saying which.
 * The account setting decides when set; otherwise a recorder sample at the same SoC, whose
 * range is in km, tells km from miles by the ratio.
 */
export function rangeMeters(
  raw: number | null,
  distanceUnit: string | null,
  sample: ParallaxBattery | null,
  socPct: number | null,
): number | null {
  if (raw === null) return null
  const unit = distanceUnit?.toLowerCase() ?? ''
  if (unit.startsWith('mi')) return Math.round(raw * M_PER_MI)
  if (unit.startsWith('k')) return raw * 1000
  if (!sample || socPct === null || sample.rangeKm <= 0) return null
  if (Math.abs(sample.socPct - socPct) > 1) return null
  const ratio = raw / sample.rangeKm
  if (ratio > 0.9 && ratio < 1.1) return raw * 1000
  if (ratio > 0.55 && ratio < 0.7) return Math.round(raw * M_PER_MI)
  return null
}

/**
 * Cabin temperature in °C. The unit comes from the account setting; without one, a driver
 * setpoint above 45 can only be °F.
 */
export function celsius(
  value: number | null,
  temperatureUnit: string | null,
  setpoint: number | null,
): number | null {
  if (value === null) return null
  const unit = temperatureUnit?.toLowerCase() ?? ''
  const fahrenheit = unit ? unit.startsWith('f') : setpoint !== null && setpoint > 45
  return fahrenheit ? Math.round(((value - 32) * 5) / 9) : value
}

export function buildStatus(input: StatusInput): StatusView {
  const { state, settings } = input
  const v = (key: string): StateValue => state[key]?.value ?? null
  const num = (key: string) => {
    const x = v(key)
    return typeof x === 'number' && Number.isFinite(x) ? x : null
  }
  const str = (key: string) => {
    const x = v(key)
    if (typeof x === 'boolean') return String(x)
    return typeof x === 'string' && x !== '' && x !== 'undefined' ? x : null
  }
  /** true or false for the two known values, null for anything else such as signal_not_available. */
  const flag = (key: string, yes: string, no: string) => {
    const x = str(key)?.toLowerCase()
    return x === yes ? true : x === no ? false : null
  }
  const opening = (prefix: string): Opening => ({
    open: flag(`${prefix}Closed`, 'open', 'closed'),
    locked: flag(`${prefix}Locked`, 'locked', 'unlocked'),
  })

  const doors = Object.fromEntries(CORNERS.map(([c, pos]) => [c, opening(`door${pos}`)])) as Record<
    Corner,
    Opening
  >
  const windows = Object.fromEntries(
    CORNERS.map(([c, pos]) => [c, flag(`window${pos}Closed`, 'open', 'closed')]),
  ) as Record<Corner, boolean | null>
  const closures: ClosureStatus[] = CLOSURES.flatMap(([id, key, label]) => {
    const o = opening(`closure${key}`)
    return o.open === null && o.locked === null ? [] : [{ id, label, ...o }]
  })
  const tires = Object.fromEntries(
    CORNERS.map(([c, pos]) => [c, tireStatus(str(`tirePressureStatus${pos}`))]),
  ) as Record<Corner, TireStatus>

  const locks = [...Object.values(doors), ...closures]
    .map((o) => o.locked)
    .filter((l) => l !== null)
  const locked = locks.length ? locks.every(Boolean) : null

  const socRaw = num('batteryLevel')
  const socPct = socRaw === null ? null : Math.round(socRaw * 10) / 10
  const limitPct = num('batteryLimit')
  const rangeRaw = num('distanceToEmpty')
  const chargeState = chargingState(str('chargerStatus'), str('chargerState'), socPct, limitPct)
  const validity = str('chargingTimeEstimationValidity')
  const minutes = num('timeToEndOfCharge')

  const setpointRaw = num('cabinClimateDriverTemperature')
  const tempUnit = settings?.temperatureUnit ?? null

  const cc = state.cloudConnection
  const lastSync = cc?.lastSync ? Date.parse(cc.lastSync) : Number.NaN
  const loc = state.gnssLocation
  const powerState = str('powerState')?.toLowerCase() ?? null
  const gear = str('gearStatus')?.toLowerCase() ?? null

  // Live gear and power win. The recorder keeps a drive open for minutes after the vehicle
  // stops, so it only counts when the vehicle sends no gear signal.
  const recorderDrive = input.drive !== null && gear === null && powerState !== 'sleep'
  const activity: Activity =
    recorderDrive || (gear !== null && gear !== 'park' && powerState === 'go')
      ? 'driving'
      : chargeState === 'charging'
        ? 'charging'
        : powerState === 'sleep'
          ? 'asleep'
          : 'parked'

  const view: StatusView = {
    kind: 'status',
    at: input.at,
    vehicle: {
      id: input.vehicle.id,
      name: input.vehicle.name,
      model: input.vehicle.model,
      modelYear: input.vehicle.modelYear || null,
      shape: bodyShape(input.vehicle.model),
    },
    activity,
    online: typeof cc?.isOnline === 'boolean' ? cc.isOnline : null,
    lastSyncAt: Number.isFinite(lastSync) ? lastSync : null,
    powerState,
    gear,
    driveMode: str('driveMode'),
    drive: input.drive,
    battery: {
      socPct,
      limitPct,
      rangeM: rangeMeters(rangeRaw, settings?.distanceUnit ?? null, input.parallaxBattery, socPct),
      rangeRaw,
      capacityKwh: num('batteryCapacity'),
      low: str('rangeThreshold') === 'vehicle_range_low',
    },
    charging: {
      state: chargeState,
      minutesToFull:
        chargeState === 'charging' && minutes !== null && minutes > 0 && validity !== 'SNA'
          ? minutes
          : null,
      powerKw: chargeState === 'charging' ? input.powerKw : null,
      disabled: Boolean(num('chargingDisabledAll') || num('chargingDisabledAC')),
    },
    locked,
    doors,
    windows,
    closures,
    tires,
    gearGuardLocked: flag('gearGuardLocked', 'locked', 'unlocked'),
    cabin: {
      tempC: celsius(num('cabinClimateInteriorTemperature'), tempUnit, setpointRaw),
      setpointC: celsius(setpointRaw, tempUnit, setpointRaw),
      preconditioning: str('cabinPreconditioningStatus')?.toLowerCase() === 'active',
      petMode: str('petModeStatus')?.toLowerCase() === 'on',
      defrost: str('defrostDefogStatus')?.toLowerCase() === 'on',
    },
    odometerM: num('vehicleMileage'),
    location:
      typeof loc?.latitude === 'number' && typeof loc.longitude === 'number'
        ? { lat: loc.latitude, lon: loc.longitude, place: input.place }
        : null,
    software: software(str, num, input.ota),
    alerts: [],
  }
  view.alerts = alerts(view, str, num)
  return view
}

function tireStatus(value: string | null): TireStatus {
  const x = value?.toLowerCase()
  if (!x) return null
  if (x.includes('crit')) return 'critical'
  if (x.includes('low')) return 'low'
  if (x === 'ok' || x === 'normal') return 'ok'
  return null
}

function chargingState(
  status: string | null,
  state: string | null,
  socPct: number | null,
  limitPct: number | null,
): ChargeState | null {
  if (state === 'charging_active' || status === 'chrgr_sts_connected_charging') return 'charging'
  if (status?.startsWith('chrgr_sts_connected')) {
    const full =
      state?.includes('complete') ||
      (socPct !== null && limitPct !== null && socPct >= limitPct - 1)
    return full ? 'complete' : 'plugged'
  }
  if (status === 'chrgr_sts_not_connected') return 'unplugged'
  return null
}

const ZEROISH = new Set(['', '0', '0.0.0', 'undefined'])
const version = (x: string | null | undefined) => (x && !ZEROISH.has(x) ? x : null)
const httpsUrl = (x: string | null | undefined) => (x?.startsWith('https://') ? x : null)

function software(
  str: (key: string) => string | null,
  num: (key: string) => number | null,
  ota: OtaStatus | null,
): StatusView['software'] {
  const available =
    version(str('otaAvailableVersion')) ?? version(ota?.availableOTAUpdateDetails?.version)
  const raw = str('otaStatus') ?? ota?.vehicleState?.otaStatus?.value ?? null
  const status =
    raw === null
      ? available
        ? 'Update available'
        : null
      : raw.toLowerCase() === 'idle'
        ? available
          ? 'Update available'
          : 'Up to date'
        : raw
            .replaceAll('_', ' ')
            .replace(/^(.)(.*)$/, (_, a: string, b: string) => a + b.toLowerCase())
  const positive = (key: string) => {
    const x = num(key)
    return x !== null && x > 0 ? x : null
  }
  return {
    current: version(str('otaCurrentVersion')) ?? version(ota?.currentOTAUpdateDetails?.version),
    available,
    status,
    downloadPct: positive('otaDownloadProgress'),
    installPct: positive('otaInstallProgress'),
    installDurationMin: positive('otaInstallDuration'),
    currentNotesUrl: httpsUrl(ota?.currentOTAUpdateDetails?.url),
    availableNotesUrl: available ? httpsUrl(ota?.availableOTAUpdateDetails?.url) : null,
  }
}

const list = (items: string[]) => items.join(', ')

function alerts(
  view: StatusView,
  str: (key: string) => string | null,
  num: (key: string) => number | null,
): Alert[] {
  const out: Alert[] = []
  const add = (level: Alert['level'], text: string) => out.push({ level, text })
  const lower = (key: string) => str(key)?.toLowerCase() ?? null

  if (lower('alarmSoundStatus') === 'true') add('critical', 'Alarm is sounding')
  const thermal = lower('batteryHvThermalEvent')
  if (thermal && thermal !== 'off' && thermal !== 'nominal') {
    add('critical', `High-voltage battery thermal event: ${thermal}`)
  }
  const corners = (pick: (c: Corner) => boolean) =>
    CORNERS.filter(([c]) => pick(c)).map(([, , label]) => label)

  const openDoors = corners((c) => view.doors[c].open === true)
  if (openDoors.length) add('warning', `Door open: ${list(openDoors)}`)
  const openClosures = view.closures.filter((c) => c.open).map((c) => c.label)
  if (openClosures.length) add('warning', `Open: ${list(openClosures)}`)
  const openWindows = corners((c) => view.windows[c] === true)
  if (openWindows.length) add('warning', `Window open: ${list(openWindows)}`)
  // Open doors and closures are reported above, so this lists only closed, unlocked ones.
  const unlocked = [
    ...corners((c) => view.doors[c].locked === false && !view.doors[c].open).map(
      (d) => `${d} door`,
    ),
    ...view.closures.filter((c) => c.locked === false && !c.open).map((c) => c.label.toLowerCase()),
  ]
  if (unlocked.length && view.activity !== 'driving') add('warning', `Unlocked: ${list(unlocked)}`)
  for (const level of ['critical', 'low'] as const) {
    const tires = corners((c) => view.tires[c] === level)
    if (tires.length) {
      add(level === 'critical' ? 'critical' : 'warning', `Tire pressure ${level}: ${list(tires)}`)
    }
  }
  if (view.battery.low) add('warning', 'Range is low')
  if (view.charging.disabled) add('warning', 'Charging is disabled')
  if (view.software.status === 'Failed') add('warning', 'Software update failed')

  const twelveVolt = str('twelveVoltBatteryHealth')
  if (twelveVolt && twelveVolt !== 'NORMAL_OPERATION') add('warning', `12V battery: ${twelveVolt}`)
  const wiper = lower('wiperFluidState')
  if (wiper && wiper !== 'normal') add('warning', `Washer fluid: ${wiper}`)
  const brake = str('brakeFluidLow')
  if (brake && brake !== 'false' && brake !== 'off') add('warning', 'Brake fluid low')
  const btm = str('btmOcHardwareFailureStatus')
  if (btm && btm !== 'dtc_not_set') add('warning', `Battery hardware: ${btm}`)

  if (num('batteryNeedsLfpCalibration')) add('info', 'Charge to 100% to calibrate the LFP pack')
  const accel = num('limitedAccelCold')
  if (accel) add('info', `Acceleration limited by cold battery (${accel}%)`)
  const regen = num('limitedRegenCold')
  if (regen) add('info', `Regen limited by cold battery (${regen}%)`)
  if (view.cabin.petMode) add('info', 'Pet mode is on')
  if (lower('serviceMode') === 'on') add('info', 'Service mode is on')
  if (lower('carWashMode') === 'on') add('info', 'Car wash mode is on')
  return out
}

const ACTIVITY: Record<Activity, string> = {
  driving: 'Driving',
  charging: 'Charging',
  parked: 'Parked',
  asleep: 'Parked, asleep',
}

/** The text content for the model: the same facts as the dashboard, metric. */
export function describeStatus(s: StatusView): string {
  const b = s.battery
  const title = s.vehicle.name ?? `${s.vehicle.modelYear ?? ''} ${s.vehicle.model}`.trim()
  const range =
    b.rangeM !== null
      ? `${Math.round(b.rangeM / 1000)} km range`
      : b.rangeRaw !== null
        ? `${b.rangeRaw} range (vehicle distance unit)`
        : null
  const charge = {
    unplugged: 'Not plugged in',
    plugged: 'Plugged in, not charging',
    complete: 'Plugged in, charge complete',
    charging: [
      'Charging',
      s.charging.powerKw !== null ? `${s.charging.powerKw} kW (reported)` : null,
      s.charging.minutesToFull !== null ? `${s.charging.minutesToFull} min to limit` : null,
    ]
      .filter(Boolean)
      .join(', '),
  }
  const sw = s.software
  const lines = [
    `${title} (${s.vehicle.model}): ${ACTIVITY[s.activity]}${s.location?.place ? ` near ${s.location.place}` : ''}.`,
    s.locked === null ? null : s.locked ? 'Locked.' : 'Not fully locked.',
    [
      b.socPct !== null ? `Battery ${Math.round(b.socPct)}%` : null,
      b.limitPct !== null ? `limit ${b.limitPct}%` : null,
      range,
    ]
      .filter(Boolean)
      .join(', ') || null,
    s.charging.state ? `${charge[s.charging.state]}.` : null,
    sw.current || sw.available
      ? [
          sw.current ? `Software ${sw.current}` : 'Software',
          sw.available ? `update ${sw.available} available` : null,
          sw.status && sw.status !== 'Update available' ? sw.status.toLowerCase() : null,
        ]
          .filter(Boolean)
          .join(', ')
      : null,
    s.cabin.tempC !== null ? `Cabin ${s.cabin.tempC} °C.` : null,
    s.online === false ? 'Vehicle offline; values are from its last sync.' : null,
    s.alerts.length
      ? `Attention: ${s.alerts.map((a) => a.text).join('; ')}.`
      : 'Nothing needs attention.',
  ]
  return lines.filter(Boolean).join('\n')
}
