import assert from 'node:assert/strict'
import { test } from 'node:test'
import { dayRange } from '../ui/format.ts'

const tz = 'America/Denver'
const key = (days: [number, number, number][]) => days.map(([, m, d]) => `${m}-${d}`)

test('dayRange includes March 8 across the spring DST change', () => {
  const from = Date.parse('2026-03-07T23:30:00-07:00')
  const to = Date.parse('2026-03-14T12:00:00-06:00')
  assert.deepEqual(key(dayRange(from, to, tz)), [
    '3-7',
    '3-8',
    '3-9',
    '3-10',
    '3-11',
    '3-12',
    '3-13',
    '3-14',
  ])
})

test('dayRange lists November 1 once across the fall DST change', () => {
  const from = Date.parse('2026-11-01T00:30:00-06:00')
  const to = Date.parse('2026-11-04T12:00:00-07:00')
  assert.deepEqual(key(dayRange(from, to, tz)), ['11-1', '11-2', '11-3', '11-4'])
})
