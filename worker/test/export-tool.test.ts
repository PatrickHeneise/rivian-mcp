import assert from 'node:assert/strict'
import { test } from 'node:test'
import { registerTools } from '../src/mcp.ts'
import { BOULDER_START_MS, boulderToLongmont, fakeD1 } from './support/d1.ts'
import './support/cloudflare-stub.ts'

type Content = { type: 'text'; text: string }[]
type Handler = (args: Record<string, unknown>) => Promise<{ content: Content }>

function setup() {
  const { db, sqlite } = fakeD1()
  const tools = new Map<string, Handler>()
  const server = { registerTool: (name: string, _def: unknown, fn: Handler) => tools.set(name, fn) }
  registerTools(server as never, { DB: db } as never)
  const insertDrive = sqlite.prepare(
    `INSERT INTO drives (id, vehicle_id, started_at, ended_at, start_lat, start_lon, end_lat, end_lon, distance_m, max_speed_mps, point_count)
VALUES (?, 'v1', ?, ?, 40.05, -105.28, 40.15, -105.16, ?, 20, 2)`,
  )
  const insertPoint = sqlite.prepare(
    'INSERT INTO points (drive_id, ts, lat, lon, alt) VALUES (?, ?, ?, ?, NULL)',
  )
  const drive = (id: string, startedAt: number, endedAt: number | null, distanceM: number) => {
    insertDrive.run(id, startedAt, endedAt, distanceM)
    insertPoint.run(id, startedAt, 40.05, -105.28)
    insertPoint.run(id, startedAt + 60_000, 40.15, -105.16)
  }
  const call = (args: Record<string, unknown>) =>
    (tools.get('export_drive') as Handler)({
      format: 'roadbook',
      max_points: 100,
      include_noise: false,
      ...args,
    })
  return { drive, call }
}

// Photon is unreachable in tests: the geocoder treats a failed request as unknown.
globalThis.fetch = (async () => new Response('down', { status: 500 })) as typeof fetch

const HOUR = 3_600_000
const T = BOULDER_START_MS

test('export_drive by id refuses a drive that is still open', async () => {
  const { drive, call } = setup()
  drive('open', T, null, 5000)
  const out = await call({ id: 'open' })
  assert.match(out.content[0].text, /in progress/)
  assert.equal(out.content[0].text.includes('roadbook.drive/1'), false)
})

test('export_drive filters noise before the limit', async () => {
  const { drive, call } = setup()
  drive('valid', T, T + 60_000, 1000)
  drive('slow', T + 2 * HOUR, T + 3 * HOUR, 1000)
  const latest = await call({})
  assert.match(latest.content[0].text, /"id":"valid"/)
  const range = await call({ since: '2026-10-13', until: '2026-10-14' })
  assert.match(range.content[0].text, /"id":"valid"/)
})

test('a truncated export keeps its notice out of the GPX and JSON text', async () => {
  const { drive, call } = setup()
  for (let i = 0; i < 51; i++) drive(`d${i}`, T + i * HOUR, T + i * HOUR + 60_000, 1000)
  const range = { since: '2026-10-13', until: '2026-10-20' }
  const gpx = await call({ ...range, format: 'gpx' })
  assert.ok(gpx.content[0].text.trimEnd().endsWith('</gpx>'))
  assert.match(gpx.content[1].text, /Stopped at 50 drives/)
  const json = await call(range)
  JSON.parse(json.content[0].text)
  assert.match(json.content[1].text, /Stopped at 50 drives/)
})
