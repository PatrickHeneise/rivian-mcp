import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import {
  emptySession,
  getAllChargingHistory,
  getChargingHistory,
  getChargingState,
  getLiveChargingSession,
} from '../src/rivian-api.ts'

const session = emptySession()

// ── Mock fetch ────────────────────────────────────────────────────────

let requests: { operationName: string; query: string; variables: Record<string, unknown> }[] = []
let responses: unknown[] = []

beforeEach(() => {
  requests = []
  responses = []
  globalThis.fetch = (async (_url: unknown, options: RequestInit) => {
    requests.push(JSON.parse(options.body as string))
    const data = responses.shift()
    return { ok: true, json: async () => ({ data }) }
  }) as unknown as typeof fetch
})

const item = (id: string, extra = {}) => ({
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
  const sessions = await getChargingHistory(session, 'v1')
  assert.ok(sessions)
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
  const sessions = await getChargingHistory(session, 'v1')
  assert.ok(sessions)
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
  await assert.rejects(getChargingHistory(session, 'v1'), /repeated cursor/)
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
  await assert.rejects(getChargingHistory(session, 'v1'), /page 2 after 1 sessions/)
})

test('getChargingHistory returns null when the first page is null', async () => {
  responses.push({ getCompletedSessionSummariesV2: null })
  assert.equal(await getChargingHistory(session, 'v1'), null)
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
  const history = await getChargingHistory(session, 'v1')
  assert.ok(history)
  const [paid, home] = history
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

test('getAllChargingHistory merges every vehicle newest first', async () => {
  responses.push(
    { currentUser: { vehicles: [{ id: 'v1' }, { id: 'v2' }] } },
    {
      getCompletedSessionSummariesV2: {
        items: [item('old', { startDateTime: '2026-09-01T10:00:00Z' })],
        pageInfo: { nextCursor: null, hasNextPage: false },
      },
    },
    {
      getCompletedSessionSummariesV2: {
        items: [item('new', { startDateTime: '2026-10-01T10:00:00Z' })],
        pageInfo: { nextCursor: null, hasNextPage: false },
      },
    },
  )
  const sessions = await getAllChargingHistory(session)
  assert.ok(sessions)
  assert.deepEqual(
    requests.slice(1).map((r) => r.variables.vehicleId),
    ['v1', 'v2'],
  )
  assert.deepEqual(
    sessions.map((s) => s.transactionId),
    ['new', 'old'],
  )
})

test('getAllChargingHistory returns null when currentUser is null', async () => {
  responses.push({ currentUser: null })
  assert.equal(await getAllChargingHistory(session), null)
})

// ── getLiveChargingSession ────────────────────────────────────────────

test('getLiveChargingSession queries getLiveSessionHistory', async () => {
  responses.push({ getLiveSessionHistory: { transactionId: 't1', soc: { value: 50 } } })
  const data = await getLiveChargingSession(session, 'v1')
  assert.ok(data)
  assert.equal(requests[0].operationName, 'getLiveSessionHistory')
  assert.doesNotMatch(requests[0].query, /getLiveSessionData/)
  assert.equal(data.transactionId, 't1')
})

test('getLiveChargingSession returns null when no session is active', async () => {
  responses.push({
    getLiveSessionHistory: { transactionId: null, startTime: null, soc: null, chartData: [] },
  })
  assert.equal(await getLiveChargingSession(session, 'v1'), null)
})

// ── getChargingState ──────────────────────────────────────────────────

test('getChargingState reads only the charging fields from vehicle state', async () => {
  responses.push({ vehicleState: { chargerState: { timeStamp: 't', value: 'charging_active' } } })
  const state = await getChargingState(session, 'v1')
  assert.equal(state.chargerState?.value, 'charging_active')
  assert.equal(requests[0].variables.vehicleID, 'v1')
  for (const field of ['batteryLevel', 'batteryLimit', 'timeToEndOfCharge', 'chargerState']) {
    assert.match(requests[0].query, new RegExp(`${field} \\{ timeStamp value \\}`))
  }
  assert.doesNotMatch(requests[0].query, /gnssLocation/)
})

test('getChargingHistory rejects an incomplete page without a continuation cursor', async () => {
  responses.push({
    getCompletedSessionSummariesV2: {
      items: [item('a')],
      pageInfo: { nextCursor: null, hasNextPage: true },
    },
  })
  await assert.rejects(getChargingHistory(session, 'v1'), /missing a continuation cursor/)
})
