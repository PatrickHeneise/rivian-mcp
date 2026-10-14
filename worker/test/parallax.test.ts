import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  decodeCharging,
  decodeGnss,
  decodeOdometerKm,
  decodePowerState,
  RVM_BATTERY,
  RVM_CHARGE_BREAKDOWN,
  RVM_CHARGING_STATUS,
  RVM_CHARGING_TIME,
} from '../src/parallax.ts'

const varint = (n: number): number[] => {
  const out: number[] = []
  while (n >= 0x80) {
    out.push((n % 0x80) | 0x80)
    n = Math.floor(n / 0x80)
  }
  out.push(n)
  return out
}
const double = (field: number, v: number) => {
  const b = new Uint8Array(8)
  new DataView(b.buffer).setFloat64(0, v, true)
  return [...varint(field * 8 + 1), ...b]
}
const float = (field: number, v: number) => {
  const b = new Uint8Array(4)
  new DataView(b.buffer).setFloat32(0, v, true)
  return [...varint(field * 8 + 5), ...b]
}
const uint = (field: number, v: number) => [...varint(field * 8), ...varint(v)]
const nested = (field: number, bytes: number[]) => [
  ...varint(field * 8 + 2),
  ...varint(bytes.length),
  ...bytes,
]
const base64 = (bytes: number[]) => btoa(String.fromCharCode(...bytes))

test('decodeGnss reads position, altitude, bearing and speed', () => {
  const payload = base64([
    ...double(1, 10.5),
    ...double(2, -20.25),
    ...double(3, 123.5),
    ...float(4, 12.5),
    ...float(5, -90),
    ...float(6, 3.25),
    ...uint(10, 1_400_000_000_000),
  ])
  assert.deepEqual(decodeGnss(payload), {
    lat: 10.5,
    lon: -20.25,
    alt: 123.5,
    speedMps: 12.5,
    bearing: 270,
  })
})

test('decodeGnss does not read the horizontal error as speed', () => {
  // Parked without a fix: speed is 0, so proto3 omits field 4, while field 6 keeps growing.
  const payload = base64([...double(1, 40.14946), ...double(2, -105.164452), ...float(6, 5.83)])
  assert.equal(decodeGnss(payload)?.speedMps, null)
})

test('decodeGnss returns null without a position', () => {
  assert.equal(decodeGnss(base64(float(6, 3))), null)
  assert.equal(decodeGnss(''), null)
})

test('decodePowerState maps enum values', () => {
  assert.equal(decodePowerState(base64(uint(1, 1))), 'sleep')
  assert.equal(decodePowerState(base64(uint(1, 4))), 'go')
  assert.equal(decodePowerState(''), null)
})

test('decodeOdometerKm reads a multi-byte varint', () => {
  assert.equal(decodeOdometerKm(base64(uint(1, 47_394))), 47_394)
})

test('decodeCharging reads the session status enums', () => {
  const payload = base64([...uint(1, 2), ...uint(2, 5), ...uint(3, 1)])
  assert.deepEqual(decodeCharging(RVM_CHARGING_STATUS, payload), {
    plugConnectionStatus: 2,
    displayStatus: 5,
    evseType: 1,
  })
})

test('decodeCharging reads the time to end of charge from field 2', () => {
  // Live payload from a 2025 R1S on a Level 1 charger.
  assert.deepEqual(decodeCharging(RVM_CHARGING_TIME, 'ENgY'), { timeToEndOfChargeS: 3_160 })
  assert.deepEqual(decodeCharging(RVM_CHARGING_TIME, base64(uint(1, 5_400))), {
    timeToEndOfChargeS: 5_400,
  })
})

test('decodeCharging reads the nested battery state', () => {
  const payload = base64(
    nested(1, [...double(1, 67.456), ...double(2, 88.123), ...float(3, 412.5)]),
  )
  assert.deepEqual(decodeCharging(RVM_BATTERY, payload), {
    socPct: 67.46,
    packEnergyKwh: 88.12,
    rangeKm: 412.5,
  })
})

test('decodeCharging reads the session breakdown and falls back to integer power', () => {
  const payload = base64([...float(1, 12.5), ...float(9, 11.25), ...uint(13, 3)])
  assert.deepEqual(decodeCharging(RVM_CHARGE_BREAKDOWN, payload), {
    totalKwh: 12.5,
    powerKw: 11.25,
    chargingState: 3,
  })
  assert.deepEqual(decodeCharging(RVM_CHARGE_BREAKDOWN, base64(uint(10, 7))), { powerKw: 7 })
})

test('decodeCharging ignores unknown RVMs and empty payloads', () => {
  assert.equal(decodeCharging('dynamics.vehicle.gnss', base64(uint(1, 1))), null)
  assert.equal(decodeCharging(RVM_CHARGING_TIME, ''), null)
})
