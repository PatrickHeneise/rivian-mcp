import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  formatVehicleState,
  formatOTAStatus,
  formatChargingHistory,
  formatChargingSession,
  formatChargingSchedule,
  formatDriversAndKeys,
  formatUserInfo,
} from '../lib/format.js'
import {
  vehicleState,
  vehicleStateCharging,
  vehicleStateOtaUpdate,
  otaDetails,
  otaDetailsWithUpdate,
  chargingSessions,
  chargingSchedule,
  driversAndKeys,
  chargingSession,
  userInfo,
} from './fixtures.js'

// Strip ANSI escape codes for text matching
const strip = (s) => s.replace(/\u001B\[[0-9;]*m/g, '')

// ── formatVehicleState ──────────────────────────────────────────────

describe('formatVehicleState', () => {
  test('rounds battery percentage', () => {
    const out = strip(formatVehicleState(vehicleState))
    assert.match(out, /72%/)
    assert.doesNotMatch(out, /72\.3/)
  })

  test('formats odometer with commas', () => {
    const out = strip(formatVehicleState(vehicleState))
    assert.match(out, /24,510,400/)
  })

  test('shows battery capacity', () => {
    const out = strip(formatVehicleState(vehicleState))
    assert.match(out, /Capacity/)
  })

  test('hides time to full when zero (not charging)', () => {
    const out = strip(formatVehicleState(vehicleState))
    assert.doesNotMatch(out, /Time to full/)
  })

  test('shows time to full when charging', () => {
    const out = strip(formatVehicleState(vehicleStateCharging))
    assert.match(out, /Time to full\s+3h 5m/)
  })

  test('hides remoteChargingAvailable (numeric flag)', () => {
    const out = strip(formatVehicleState(vehicleState))
    assert.doesNotMatch(out, /remoteChargingAvailable/)
    assert.doesNotMatch(out, /Remote charging/)
  })

  test('hides 0.0.0 available version', () => {
    const out = strip(formatVehicleState(vehicleState))
    assert.doesNotMatch(out, /Available update/)
    assert.doesNotMatch(out, /0\.0\.0/)
  })

  test('hides zero progress bars when idle', () => {
    const out = strip(formatVehicleState(vehicleState))
    assert.doesNotMatch(out, /Install\s+.*░.*0%/)
    assert.doesNotMatch(out, /Download\s+.*░.*0%/)
  })

  test('shows download progress when non-zero', () => {
    const out = strip(formatVehicleState(vehicleStateOtaUpdate))
    assert.match(out, /67%/)
  })

  test('shows available version when present', () => {
    const out = strip(formatVehicleState(vehicleStateOtaUpdate))
    assert.match(out, /Available update\s+2025\.46\.0/)
  })

  test('hides zero install duration and install time', () => {
    const out = strip(formatVehicleState(vehicleState))
    assert.doesNotMatch(out, /Install duration/)
    assert.doesNotMatch(out, /Install time/)
  })

  test('shows install duration when non-zero', () => {
    const out = strip(formatVehicleState(vehicleStateOtaUpdate))
    assert.match(out, /Install duration\s+45 min/)
  })

  test('hides empty available hash', () => {
    const out = strip(formatVehicleState(vehicleState))
    assert.doesNotMatch(out, /Available hash/)
  })

  test('shows available hash when present', () => {
    const out = strip(formatVehicleState(vehicleStateOtaUpdate))
    assert.match(out, /f4e2a1c9/)
  })

  test('hides preconditioning when API returns "undefined"', () => {
    const out = strip(formatVehicleState(vehicleState))
    assert.doesNotMatch(out, /Preconditioning\s+undefined/)
  })

  test('shows altitude', () => {
    const out = strip(formatVehicleState(vehicleState))
    assert.match(out, /Altitude\s+52\.3/)
  })

  test('contains all major sections', () => {
    const out = strip(formatVehicleState(vehicleState))
    for (const heading of [
      'Battery & Range',
      'Charging',
      'Doors',
      'Closures',
      'Windows',
      'Climate',
      'Seat Heat & Vent',
      'Tire Pressure',
      'Software',
      'Security',
      'Drive',
      'Connection',
      'Location',
      'Towing',
    ]) {
      assert.match(out, new RegExp(heading), `missing section: ${heading}`)
    }
  })

  test('shows door diagram indicators', () => {
    const out = strip(formatVehicleState(vehicleState))
    assert.match(out, /┌───────────┐/)
    assert.match(out, /└───────────┘/)
  })

  test('shows tire diagram', () => {
    const out = strip(formatVehicleState(vehicleState))
    assert.match(out, /FL: OK/)
    assert.match(out, /RL: Low/)
  })

  test('humanizes connection lastSync for recent sync', () => {
    const recentState = {
      cloudConnection: {
        lastSync: new Date(Date.now() - 5 * 60000).toISOString(),
        isOnline: true,
      },
    }
    const out = strip(formatVehicleState(recentState))
    assert.match(out, /Online/)
    assert.match(out, /5m ago/)
  })

  test('falls back to raw timestamp for old sync', () => {
    const out = strip(formatVehicleState(vehicleState))
    assert.match(out, /Online/)
    // Fixture is from 2025, > 24h ago, so raw ISO is shown
    assert.match(out, /2025-11-15/)
  })

  test('shows charging info when actively charging', () => {
    const out = strip(formatVehicleState(vehicleStateCharging))
    assert.match(out, /chrgr_sts_connected_charging/)
    assert.match(out, /charging_active/)
  })
})

// ── formatOTAStatus ─────────────────────────────────────────────────

describe('formatOTAStatus', () => {
  test('shows up-to-date when no update available', () => {
    const out = strip(formatOTAStatus(otaDetails))
    assert.match(out, /v2025\.42\.0/)
    assert.match(out, /up to date/)
  })

  test('shows available version when update exists', () => {
    const out = strip(formatOTAStatus(otaDetailsWithUpdate))
    assert.match(out, /v2025\.42\.0/)
    assert.match(out, /v2025\.46\.0/)
    assert.match(out, /Available/)
  })
})

// ── formatChargingHistory ───────────────────────────────────────────

describe('formatChargingHistory', () => {
  test('renders table with all sessions', () => {
    const out = strip(formatChargingHistory(chargingSessions))
    assert.match(out, /3 sessions/)
    assert.match(out, /48\.7 kWh/)
    assert.match(out, /\$12\.35/)
    assert.match(out, /Free/)
    assert.match(out, /\$7\.80/)
  })

  test('shows location detail lines', () => {
    const out = strip(formatChargingHistory(chargingSessions))
    assert.match(out, /Boulder/)
    assert.match(out, /Rivian Adventure Network/)
    assert.match(out, /ChargePoint/)
  })

  test('handles null sessions', () => {
    const out = strip(formatChargingHistory(null))
    assert.match(out, /expired/)
  })

  test('handles empty sessions', () => {
    const out = strip(formatChargingHistory([]))
    assert.match(out, /No charging history/)
  })
})

// ── formatChargingSession ───────────────────────────────────────────

describe('formatChargingSession', () => {
  test('renders active charging session', () => {
    const out = strip(formatChargingSession(chargingSession))
    assert.match(out, /52%/)
    assert.match(out, /11\.2 kW/)
    assert.match(out, /\$6\.48/)
  })

  test('handles null session', () => {
    const out = strip(formatChargingSession(null))
    assert.match(out, /No active charging session/)
  })
})

// ── formatChargingSchedule ──────────────────────────────────────────

describe('formatChargingSchedule', () => {
  test('renders schedule with time range', () => {
    const out = strip(formatChargingSchedule(chargingSchedule))
    assert.match(out, /11:00 PM/)
    assert.match(out, /48A/)
    assert.match(out, /MON/)
  })

  test('handles empty schedules', () => {
    const out = strip(formatChargingSchedule({ chargingSchedules: [] }))
    assert.match(out, /No charging schedules/)
  })
})

// ── formatDriversAndKeys ────────────────────────────────────────────

describe('formatDriversAndKeys', () => {
  test('renders drivers with devices', () => {
    const out = strip(formatDriversAndKeys(driversAndKeys))
    assert.match(out, /Alex Rivera/)
    assert.match(out, /primary_owner/)
    assert.match(out, /iPhone 16 Pro/)
    assert.match(out, /paired/)
  })

  test('renders invited user', () => {
    const out = strip(formatDriversAndKeys(driversAndKeys))
    assert.match(out, /guest@example\.com/)
    assert.match(out, /pending/)
  })

  test('shows VIN in header', () => {
    const out = strip(formatDriversAndKeys(driversAndKeys))
    assert.match(out, /7FCTGAAL5PN099887/)
  })
})

// ── formatUserInfo ──────────────────────────────────────────────────

describe('formatUserInfo', () => {
  test('renders user and vehicle info', () => {
    const out = strip(formatUserInfo(userInfo))
    assert.match(out, /Alex Rivera/)
    assert.match(out, /Blue Lightning/)
    assert.match(out, /R1S/)
    assert.match(out, /v2025\.42\.0/)
  })

  test('shows OTA early access', () => {
    const out = strip(formatUserInfo(userInfo))
    assert.match(out, /OTA early access\s+Yes/)
  })

  test('handles no vehicles', () => {
    const out = strip(
      formatUserInfo({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        vehicles: [],
      }),
    )
    assert.match(out, /No vehicles/)
  })
})
