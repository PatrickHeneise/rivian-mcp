import assert from 'node:assert/strict'
import { test } from 'node:test'
import { localDate, localIso, timezoneAt, utcIso, zoneAbbreviation } from '../src/timezone.ts'
import { BOULDER, BOULDER_START_MS } from './support/d1.ts'

test('timezoneAt finds the IANA zone of a coordinate', () => {
  assert.equal(timezoneAt(BOULDER.lat, BOULDER.lon), 'America/Denver')
  assert.equal(timezoneAt(52.52, 13.4), 'Europe/Berlin')
  assert.equal(timezoneAt(Number.NaN, 0), null)
})

test('localIso renders the offset of the zone', () => {
  assert.equal(localIso(BOULDER_START_MS, 'America/Denver'), '2026-10-13T14:04:11-06:00')
  assert.equal(localIso(BOULDER_START_MS, 'Asia/Kolkata'), '2026-10-14T01:34:11+05:30')
  assert.equal(localIso(BOULDER_START_MS, 'UTC'), '2026-10-13T20:04:11Z')
  assert.equal(localIso(BOULDER_START_MS, null), '2026-10-13T20:04:11Z')
  assert.equal(localIso(BOULDER_START_MS, 'Not/AZone'), '2026-10-13T20:04:11Z')
})

test('localDate and the zone abbreviation follow the zone', () => {
  assert.equal(localDate(BOULDER_START_MS, 'Asia/Kolkata'), '2026-10-14')
  assert.equal(zoneAbbreviation(BOULDER_START_MS, 'America/Denver'), 'MDT')
  assert.equal(zoneAbbreviation(BOULDER_START_MS, null), 'UTC')
  assert.equal(utcIso(BOULDER_START_MS), '2026-10-13T20:04:11Z')
})
