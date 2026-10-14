import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { join } from 'node:path'
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import { afterEach, test } from 'node:test'
import { emptySession } from '../../src/rivian-api.ts'

// The Recorder extends a class from `cloudflare:workers`, which only exists in the Workers runtime.
registerHooks({
  resolve(specifier, context, next) {
    if (specifier !== 'cloudflare:workers') return next(specifier, context)
    const url = new URL('./support/cloudflare-workers.ts', import.meta.url).href
    return { url, shortCircuit: true }
  },
})
const { Recorder } = await import('../src/recorder.ts')

/** The members the tests reach into. They are private in the class. */
interface Internals {
  onMessage(ws: unknown, vehicles: unknown[], data: string): Promise<void>
  flush(vehicleId: string): Promise<void>
  flushAll(): Promise<void>
  states: Map<string, { drive: { id: string; endedAt: number | null } | null }>
  alarm(): Promise<void>
}

const VEHICLE = { id: 'v', name: null, model: 'R1S', modelYear: 2025 }

class Gate {
  promise: Promise<void>
  open!: () => void
  constructor() {
    this.promise = new Promise((resolve) => {
      this.open = resolve
    })
  }
}

/** D1 on node:sqlite, with hooks to hold or fail a batch. */
function fakeD1() {
  const sqlite = new DatabaseSync(':memory:')
  const dir = join(import.meta.dirname, '../migrations')
  for (const f of readdirSync(dir).sort()) sqlite.exec(readFileSync(join(dir, f), 'utf8'))
  const hooks = { gate: null as Gate | null, failNext: false, batches: 0 }
  const statement = (sql: string, args: SQLInputValue[] = []) => ({
    bind: (...bound: SQLInputValue[]) => statement(sql, bound),
    run: async () => sqlite.prepare(sql).run(...args),
    all: async () => ({ results: sqlite.prepare(sql).all(...args) }),
    first: async () => sqlite.prepare(sql).get(...args) ?? null,
    exec: () => sqlite.prepare(sql).run(...args),
  })
  const db = {
    prepare: (sql: string) => statement(sql),
    batch: async (statements: ReturnType<typeof statement>[]) => {
      hooks.batches++
      if (hooks.gate) await hooks.gate.promise
      if (hooks.failNext) {
        hooks.failNext = false
        throw new Error('D1 unavailable')
      }
      sqlite.exec('BEGIN')
      try {
        for (const s of statements) s.exec()
        sqlite.exec('COMMIT')
      } catch (error) {
        sqlite.exec('ROLLBACK')
        throw error
      }
    },
  }
  return { db, sqlite, hooks }
}

function fakeStorage() {
  const data = new Map<string, unknown>()
  let alarm: number | null = null
  return {
    data,
    get: async (key: string) => structuredClone(data.get(key)),
    put: async (key: string, value: unknown) => void data.set(key, structuredClone(value)),
    delete: async (keys: string | string[]) => {
      for (const key of [keys].flat()) data.delete(key)
    },
    list: async ({ prefix }: { prefix: string }) =>
      new Map([...data].filter(([key]) => key.startsWith(prefix))),
    getAlarm: async () => alarm,
    setAlarm: async (at: number) => {
      alarm = at
    },
  }
}

async function setup() {
  const { db, sqlite, hooks } = fakeD1()
  const storage = fakeStorage()
  await storage.put('session', { ...emptySession(), userSessionToken: 'token' })
  await storage.put('vehicles', [VEHICLE])
  const ctx = { storage, waitUntil: (p: Promise<unknown>) => void p.catch(() => {}) }
  const env = { DB: db, RIVIAN_EMAIL: 'owner@example.com' }
  const recorder = new Recorder(ctx as never, env as never)
  const internals = recorder as unknown as Internals
  const send = (message: object) =>
    internals.onMessage({ send() {}, close() {} }, [VEHICLE], JSON.stringify(message))
  const gps = (lat: number, ts: number) =>
    send({
      id: 'state:v',
      type: 'next',
      payload: {
        data: {
          vehicleState: {
            gnssLocation: {
              latitude: lat,
              longitude: 0,
              timeStamp: new Date(ts).toISOString(),
              isAuthorized: true,
            },
          },
        },
      },
    })
  const power = (payload: string, ts: number) =>
    send({
      id: 'v',
      type: 'next',
      payload: {
        data: { parallaxMessages: { payload, timestamp: ts, rvm: 'vehicle.power.state' } },
      },
    })
  return { recorder, internals, sqlite, hooks, storage, gps, power }
}

/** Parked at lat 0, then 0.001 degree (~111 m) north: opens drive `v-<startTs>`. */
async function openDrive(t: Awaited<ReturnType<typeof setup>>, parkTs: number, startTs: number) {
  await t.gps(0, parkTs)
  await t.gps(0.001, startTs)
}

const SLEEP = 'CAE='
const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
})

test('a replayed power sample older than the drive does not close it', async () => {
  const t = await setup()
  await openDrive(t, 1_000_000, 1_005_000)
  await t.gps(0.001, 1_010_000)
  await t.power(SLEEP, 1_000)
  assert.ok(t.internals.states.get('v')?.drive)
})

test('a power sample after the last move still closes the drive', async () => {
  const t = await setup()
  await openDrive(t, 1_000_000, 1_005_000)
  await t.power(SLEEP, 1_020_000)
  assert.equal(t.internals.states.get('v')?.drive, null)
})
