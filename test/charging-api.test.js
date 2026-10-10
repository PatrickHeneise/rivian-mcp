import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { getChargingHistory, getLiveChargingSession } from '../lib/rivian-api.js'

// ── Mock fetch ────────────────────────────────────────────────────────

let requests = []
let responses = []

beforeEach(() => {
  requests = []
  responses = []
  globalThis.fetch = async (_url, options) => {
    requests.push(JSON.parse(options.body))
    const data = responses.shift()
    return { ok: true, json: async () => ({ data }) }
  }
})

const item = (id, extra = {}) => ({
  transactionId: id,
  vehicleId: 'v1',
  vehicleName: null,
  startDateTime: '2026-10-09T15:55:53.964Z',
  endDateTime: '2026-10-09T19:28:01.111Z',
  totalEnergy: 4.3,
  rangeAdded: 15,
  charger: null,
  order: null,
  ...extra,
})

// ── getChargingHistory (V2) ───────────────────────────────────────────

test('getChargingHistory pages with searchAfter until hasNextPage is false', async () => {
  responses.push(
    {
      getCompletedSessionSummariesV2: {
        items: [item('a')],
        pageInfo: { nextCursor: 'cur1', hasNextPage: true },
      },
    },
    {
      getCompletedSessionSummariesV2: {
        items: [item('b')],
        pageInfo: { nextCursor: null, hasNextPage: false },
      },
    },
  )
  const sessions = await getChargingHistory('v1')
  assert.equal(requests.length, 2)
  assert.equal(requests[0].operationName, 'getCompletedSessionSummariesV2')
  assert.deepEqual(requests[0].variables, { vehicleId: 'v1', pageSize: 100, searchAfter: null })
  assert.equal(requests[1].variables.searchAfter, 'cur1')
  assert.deepEqual(
    sessions.map((s) => s.transactionId),
    ['a', 'b'],
  )
})

test('getChargingHistory fetches past 30 pages', async () => {
  const pages = 31
  for (let i = 0; i < pages; i++) {
    const last = i === pages - 1
    responses.push({
      getCompletedSessionSummariesV2: {
        items: [item(`t${i}`)],
        pageInfo: { nextCursor: last ? null : `cur${i}`, hasNextPage: !last },
      },
    })
  }
  const sessions = await getChargingHistory('v1')
  assert.equal(requests.length, pages)
  assert.equal(sessions.length, pages)
})

test('getChargingHistory throws on a repeated cursor', async () => {
  const page = () => ({
    getCompletedSessionSummariesV2: {
      items: [item('a')],
      pageInfo: { nextCursor: 'same', hasNextPage: true },
    },
  })
  responses.push(page(), page(), page())
  await assert.rejects(getChargingHistory('v1'), /repeated cursor/)
})

test('getChargingHistory throws when a later page is null', async () => {
  responses.push(
    {
      getCompletedSessionSummariesV2: {
        items: [item('a')],
        pageInfo: { nextCursor: 'cur1', hasNextPage: true },
      },
    },
    { getCompletedSessionSummariesV2: null },
  )
  await assert.rejects(getChargingHistory('v1'), /page 2 after 1 sessions/)
})

test('getChargingHistory returns null when the first page is null', async () => {
  responses.push({ getCompletedSessionSummariesV2: null })
  assert.equal(await getChargingHistory('v1'), null)
})

test('getChargingHistory maps V2 items to the flat session shape', async () => {
  responses.push({
    getCompletedSessionSummariesV2: {
      items: [
        item('a', {
          charger: {
            name: 'Cheyenne, WY',
            type: 'UNKNOWN',
            vendor: 'Rivian Adventure Network',
            isPublic: true,
            isHomeCharger: false,
            isRoamingNetwork: false,
            address: { city: 'Cheyenne', state: 'WY', country: 'US' },
          },
          order: { currencyCode: 'USD', paidTotal: 30.02, totalCost: 30.02 },
        }),
        item('b'),
      ],
      pageInfo: { nextCursor: null, hasNextPage: false },
    },
  })
  const [paid, home] = await getChargingHistory('v1')
  assert.equal(paid.startInstant, '2026-10-09T15:55:53.964Z')
  assert.equal(paid.totalEnergyKwh, 4.3)
  assert.equal(paid.rangeAddedKm, 15)
  assert.equal(paid.vendor, 'Rivian Adventure Network')
  assert.equal(paid.city, 'Cheyenne')
  assert.equal(paid.chargerType, null, 'UNKNOWN charger type is dropped')
  assert.equal(paid.paidTotal, 30.02)
  assert.equal(paid.currencyCode, 'USD')
  assert.equal(home.vendor, null)
  assert.equal(home.paidTotal, null)
})

// ── getLiveChargingSession ────────────────────────────────────────────

test('getLiveChargingSession queries getLiveSessionHistory', async () => {
  responses.push({ getLiveSessionHistory: { transactionId: 't1', soc: { value: 50 } } })
  const data = await getLiveChargingSession('v1')
  assert.equal(requests[0].operationName, 'getLiveSessionHistory')
  assert.doesNotMatch(requests[0].query, /getLiveSessionData/)
  assert.equal(data.transactionId, 't1')
})

test('getLiveChargingSession returns null when no session is active', async () => {
  responses.push({
    getLiveSessionHistory: { transactionId: null, startTime: null, soc: null, chartData: [] },
  })
  assert.equal(await getLiveChargingSession('v1'), null)
})
