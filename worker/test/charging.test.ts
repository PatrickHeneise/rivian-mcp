import assert from 'node:assert/strict'
import { test } from 'node:test'
import { SAMPLE_MS, shouldSample } from '../src/charging.ts'
import { RVM_BATTERY, RVM_CHARGING_STATUS } from '../src/parallax.ts'

test('shouldSample stores the first sample', () => {
  assert.equal(shouldSample(RVM_BATTERY, undefined, 0, '{}'), true)
})

test('shouldSample throttles to one sample per window', () => {
  const last = { ts: 1_000, data: '{"socPct":50}' }
  assert.equal(shouldSample(RVM_BATTERY, last, 1_000 + SAMPLE_MS - 1, '{"socPct":51}'), false)
  assert.equal(shouldSample(RVM_BATTERY, last, 1_000 + SAMPLE_MS, '{"socPct":51}'), true)
})

test('shouldSample stores every status change', () => {
  const last = { ts: 1_000, data: '{"plugConnectionStatus":1}' }
  assert.equal(shouldSample(RVM_CHARGING_STATUS, last, 2_000, '{"plugConnectionStatus":2}'), true)
  assert.equal(shouldSample(RVM_CHARGING_STATUS, last, 2_000, '{"plugConnectionStatus":1}'), false)
})
