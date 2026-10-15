import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { StateValue, VehicleState } from '../../src/rivian-api.ts'
import {
  bodyShape,
  buildStatus,
  celsius,
  describeStatus,
  rangeMeters,
  type StatusInput,
} from '../src/status.ts'

const AT = Date.UTC(2026, 9, 14, 18, 0, 0)
const ts = '2026-10-14T17:58:00Z'

function state(values: Record<string, StateValue>): VehicleState {
  const out: VehicleState = Object.fromEntries(
    Object.entries(values).map(([k, value]) => [k, { timeStamp: ts, value }]),
  )
  out.cloudConnection = { isOnline: true, lastSync: ts }
  out.gnssLocation = { latitude: 40.05, longitude: -105.28, timeStamp: ts }
  return out
}

/** A parked, locked R1S from the confirmed example values. */
const PARKED: Record<string, StateValue> = {
  powerState: 'sleep',
  gearStatus: 'park',
  batteryLevel: 48.600002,
  batteryLimit: 85,
  distanceToEmpty: 300,
  vehicleMileage: 47393698,
  rangeThreshold: 'vehicle_range_normal',
  chargerStatus: 'chrgr_sts_not_connected',
  chargerState: 'charging_ready',
  timeToEndOfCharge: 0,
  chargingTimeEstimationValidity: 'SNA',
  chargingDisabledAC: 0,
  chargingDisabledAll: 0,
  doorFrontLeftClosed: 'closed',
  doorFrontRightClosed: 'closed',
  doorRearLeftClosed: 'closed',
  doorRearRightClosed: 'closed',
  doorFrontLeftLocked: 'locked',
  doorFrontRightLocked: 'locked',
  doorRearLeftLocked: 'locked',
  doorRearRightLocked: 'locked',
  closureFrunkClosed: 'closed',
  closureFrunkLocked: 'locked',
  closureLiftgateClosed: 'closed',
  closureLiftgateLocked: 'locked',
  closureTailgateClosed: 'signal_not_available',
  closureTonneauClosed: 'signal_not_available',
  windowFrontLeftClosed: 'closed',
  windowFrontRightClosed: 'closed',
  windowRearLeftClosed: 'closed',
  windowRearRightClosed: 'closed',
  tirePressureStatusFrontLeft: 'OK',
  tirePressureStatusFrontRight: 'OK',
  tirePressureStatusRearLeft: 'OK',
  tirePressureStatusRearRight: 'OK',
  cabinClimateInteriorTemperature: 19,
  cabinClimateDriverTemperature: 24,
  cabinPreconditioningStatus: 'undefined',
  petModeStatus: 'Off',
  gearGuardLocked: 'locked',
  alarmSoundStatus: 'false',
  otaCurrentVersion: '2026.31.0',
  otaAvailableVersion: '0.0.0',
  otaStatus: 'Idle',
  otaDownloadProgress: 0,
  otaInstallProgress: 0,
  batteryHvThermalEvent: 'off',
  twelveVoltBatteryHealth: 'NORMAL_OPERATION',
  wiperFluidState: 'normal',
  brakeFluidLow: null,
  limitedAccelCold: 0,
  limitedRegenCold: 0,
  btmOcHardwareFailureStatus: 'dtc_not_set',
}

function input(
  over: Record<string, StateValue> = {},
  extra: Partial<StatusInput> = {},
): StatusInput {
  return {
    at: AT,
    vehicle: { id: 'v1', name: null, model: 'R1S', modelYear: 2025 },
    state: state({ ...PARKED, ...over }),
    ota: null,
    settings: null,
    parallaxBattery: null,
    powerKw: null,
    drive: null,
    place: 'Boulder, Colorado',
    ...extra,
  }
}

test('bodyShape picks the drawing per model', () => {
  assert.equal(bodyShape('R1T'), 'R1T')
  assert.equal(bodyShape('R1S'), 'R1S')
  assert.equal(bodyShape('R2'), 'R2')
  assert.equal(bodyShape('R3X'), 'R2')
  assert.equal(bodyShape('unknown'), 'R1S')
})

test('rangeMeters uses the account distance unit first', () => {
  assert.equal(rangeMeters(300, 'km', null, 50), 300_000)
  assert.equal(rangeMeters(300, 'miles', null, 50), 482_803)
})

test('rangeMeters tells km from miles by a recorder sample at the same SoC', () => {
  assert.equal(rangeMeters(300, null, { socPct: 48.5, rangeKm: 302 }, 48.6), 300_000)
  assert.equal(rangeMeters(187, null, { socPct: 48.5, rangeKm: 302 }, 48.6), 300_947)
  // A sample at another SoC says nothing about the unit.
  assert.equal(rangeMeters(300, null, { socPct: 60, rangeKm: 302 }, 48.6), null)
  assert.equal(rangeMeters(300, null, null, 48.6), null)
})

test('celsius converts °F by setting or by a setpoint only °F allows', () => {
  assert.equal(celsius(19, null, 24), 19)
  assert.equal(celsius(68, null, 72), 20)
  assert.equal(celsius(68, 'fahrenheit', null), 20)
  assert.equal(celsius(20, 'celsius', 72), 20)
})

test('a parked, locked vehicle has nothing to report', () => {
  const view = buildStatus(input())
  assert.equal(view.activity, 'asleep')
  assert.equal(view.locked, true)
  assert.equal(view.battery.socPct, 48.6)
  assert.equal(view.charging.state, 'unplugged')
  assert.equal(view.charging.minutesToFull, null)
  assert.deepEqual(
    view.closures.map((c) => c.id),
    ['frunk', 'liftgate'],
  )
  assert.equal(view.software.status, 'Up to date')
  assert.equal(view.software.available, null)
  assert.equal(view.odometerM, 47393698)
  assert.equal(view.cabin.preconditioning, false)
  assert.deepEqual(view.location, { lat: 40.05, lon: -105.28, place: 'Boulder, Colorado' })
  assert.deepEqual(view.alerts, [])
})

test('open and unlocked doors, open windows and low tires become alerts', () => {
  const view = buildStatus(
    input({
      doorRearRightClosed: 'open',
      doorFrontLeftLocked: 'unlocked',
      closureFrunkLocked: 'unlocked',
      windowRearLeftClosed: 'open',
      tirePressureStatusFrontRight: 'Low',
    }),
  )
  assert.equal(view.locked, false)
  assert.equal(view.doors.rr.open, true)
  assert.equal(view.windows.rl, true)
  assert.equal(view.tires.fr, 'low')
  assert.deepEqual(
    view.alerts.map((a) => a.text),
    [
      'Door open: rear right',
      'Window open: rear left',
      'Unlocked: front left door, frunk',
      'Tire pressure low: front right',
    ],
  )
})

test('an open, unlocked closure is reported once', () => {
  const view = buildStatus(
    input({ closureLiftgateClosed: 'open', closureLiftgateLocked: 'unlocked' }),
  )
  assert.equal(view.locked, false)
  assert.deepEqual(
    view.alerts.map((a) => a.text),
    ['Open: Liftgate'],
  )
})

test('an active charge reports power and time to the limit', () => {
  const view = buildStatus(
    input(
      {
        powerState: 'ready',
        chargerStatus: 'chrgr_sts_connected_charging',
        chargerState: 'charging_active',
        timeToEndOfCharge: 95,
        chargingTimeEstimationValidity: 'valid',
      },
      { powerKw: 11.2 },
    ),
  )
  assert.equal(view.activity, 'charging')
  assert.equal(view.charging.state, 'charging')
  assert.equal(view.charging.minutesToFull, 95)
  assert.equal(view.charging.powerKw, 11.2)
})

test('plugged in at the limit is complete', () => {
  const view = buildStatus(
    input({ batteryLevel: 84.6, chargerStatus: 'chrgr_sts_connected_no_chrg' }, { powerKw: 7 }),
  )
  assert.equal(view.charging.state, 'complete')
  assert.equal(view.charging.powerKw, null)
})

test('an available update carries its release notes, https only', () => {
  const view = buildStatus(
    input(
      {
        otaAvailableVersion: '2026.35.1',
        otaStatus: 'Ready_To_Install',
        otaDownloadProgress: 100,
        otaInstallDuration: 25,
      },
      {
        ota: {
          currentOTAUpdateDetails: { version: '2026.31.0', url: 'http://example.com/notes' },
          availableOTAUpdateDetails: { version: '2026.35.1', url: 'https://rivian.com/notes' },
        },
      },
    ),
  )
  assert.equal(view.software.available, '2026.35.1')
  assert.equal(view.software.status, 'Ready to install')
  assert.equal(view.software.downloadPct, 100)
  assert.equal(view.software.installDurationMin, 25)
  assert.equal(view.software.availableNotesUrl, 'https://rivian.com/notes')
  assert.equal(view.software.currentNotesUrl, null)
})

test('an open recorder drive means driving and hides the unlocked alert', () => {
  const view = buildStatus(
    input(
      { powerState: 'go', gearStatus: 'drive', doorFrontLeftLocked: 'unlocked' },
      { drive: { startedAt: AT - 600_000, distanceM: 5400 } },
    ),
  )
  assert.equal(view.activity, 'driving')
  assert.equal(view.alerts.length, 0)
})

test('live parked and charging signals win over an open recorder drive', () => {
  const drive = { startedAt: AT - 600_000, distanceM: 5400 }
  const parked = buildStatus(
    input({ powerState: 'ready', gearStatus: 'park', doorFrontLeftLocked: 'unlocked' }, { drive }),
  )
  assert.equal(parked.activity, 'parked')
  assert.ok(parked.alerts.some((a) => a.text.startsWith('Unlocked')))
  const charging = buildStatus(
    input({ powerState: 'ready', gearStatus: 'park', chargerState: 'charging_active' }, { drive }),
  )
  assert.equal(charging.activity, 'charging')
  const noGear = buildStatus(input({ powerState: 'ready', gearStatus: null }, { drive }))
  assert.equal(noGear.activity, 'driving')
})

test('describeStatus gives the model the same facts', () => {
  const text = describeStatus(
    buildStatus(input({}, { parallaxBattery: { socPct: 48.6, rangeKm: 301 } })),
  )
  assert.equal(
    text,
    [
      '2025 R1S (R1S): Parked, asleep near Boulder, Colorado.',
      'Locked.',
      'Battery 49%, limit 85%, 300 km range',
      'Not plugged in.',
      'Software 2026.31.0, up to date',
      'Cabin 19 °C.',
      'Nothing needs attention.',
    ].join('\n'),
  )
})
