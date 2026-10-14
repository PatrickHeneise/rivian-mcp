import assert from 'node:assert/strict'
import { test } from 'node:test'
import { pointFromVehicleState } from '../src/vehicle-state.ts'

const T = '2026-10-11T22:54:56.719Z'

test('pointFromVehicleState reads the fix and its same-time values', () => {
  const point = pointFromVehicleState({
    gnssLocation: {
      latitude: 40.0247688,
      longitude: -105.0916672,
      timeStamp: T,
      isAuthorized: true,
    },
    gnssSpeed: { timeStamp: T, value: 24.5 },
    gnssBearing: { timeStamp: T, value: -90 },
    gnssAltitude: { timeStamp: T, value: 1559.6 },
  })
  assert.deepEqual(point, {
    ts: Date.parse(T),
    lat: 40.0247688,
    lon: -105.0916672,
    alt: 1559.6,
    speedMps: 24.5,
    bearing: 270,
  })
})

test('pointFromVehicleState drops values from another time', () => {
  const point = pointFromVehicleState({
    gnssLocation: { latitude: 40, longitude: -105, timeStamp: T },
    gnssSpeed: { timeStamp: '2026-10-11T22:54:51.000Z', value: 3 },
  })
  assert.equal(point?.speedMps, null)
  assert.equal(point?.alt, null)
})

test('pointFromVehicleState returns null without an authorized location', () => {
  // Most parked updates carry speed and bearing but no location.
  assert.equal(
    pointFromVehicleState({ gnssLocation: null, gnssSpeed: { timeStamp: T, value: 0 } }),
    null,
  )
  assert.equal(
    pointFromVehicleState({
      gnssLocation: { latitude: 40, longitude: -105, timeStamp: T, isAuthorized: false },
    }),
    null,
  )
  assert.equal(
    pointFromVehicleState({ gnssLocation: { latitude: null, longitude: -105, timeStamp: T } }),
    null,
  )
  assert.equal(pointFromVehicleState(undefined), null)
})
