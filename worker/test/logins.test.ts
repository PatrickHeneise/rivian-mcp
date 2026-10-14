import assert from 'node:assert/strict'
import { test } from 'node:test'
import { emptySession, type Session } from '../../src/rivian-api.ts'
import {
  finishPending,
  type LoginDeps,
  needsVehicleDiscovery,
  type RecoveryDeps,
  recoverConnection,
  startPending,
} from '../src/logins.ts'
import { PENDING_PREFIX, type PendingLogin } from '../src/pending.ts'

/** Fake Rivian: each login gets a distinct otpToken; a code is right only for its own token. */
function setup() {
  const pending = new Map<string, PendingLogin>()
  const active: { session: Session | null; writes: Session[] } = { session: null, writes: [] }
  let n = 0
  const deps: LoginDeps = {
    store: {
      get: async (key) => pending.get(key),
      put: async (key, value) => void pending.set(key, value),
      delete: async (keys) => {
        for (const k of [keys].flat()) pending.delete(k)
      },
      list: async (prefix) =>
        new Map([...pending].filter(([k]) => k.startsWith(prefix))) as Map<string, PendingLogin>,
    },
    login: async (session, password) => {
      if (password === 'direct') {
        session.userSessionToken = 'direct-token'
        return false
      }
      session.otpToken = `otp-${password}`
      return true
    },
    validateOtp: async (session, code) => {
      if (code !== `code-for-${session.otpToken}`) throw new Error('bad code')
      session.userSessionToken = `user-${session.otpToken}`
      session.otpToken = ''
    },
    activate: async (session) => {
      active.session = session
      active.writes.push(session)
    },
    newSession: emptySession,
    now: () => 1000,
    newId: () => `id${++n}`,
    inFlight: new Set(),
  }
  return { deps, pending, active }
}

test('starting overlapping sign-ins never writes the active session', async () => {
  const { deps, pending, active } = setup()
  const a = await startPending(deps, 'a')
  const b = await startPending(deps, 'b')
  assert.deepEqual(
    [a, b],
    [
      { result: 'otp_sent', pendingId: 'id1' },
      { result: 'otp_sent', pendingId: 'id2' },
    ],
  )
  assert.equal(active.writes.length, 0)
  assert.equal(pending.size, 2)
})

test('a wrong code keeps the pending session and writes nothing', async () => {
  const { deps, pending, active } = setup()
  await startPending(deps, 'a')
  await assert.rejects(finishPending(deps, 'id1', 'nope'), /bad code/)
  assert.equal(active.writes.length, 0)
  assert.ok(pending.has(`${PENDING_PREFIX}id1`))
})

test('a right code activates only its own session and keeps the other pending login', async () => {
  const { deps, pending, active } = setup()
  await startPending(deps, 'a')
  await startPending(deps, 'b')
  await finishPending(deps, 'id1', 'code-for-otp-a')
  assert.equal(active.writes.length, 1)
  assert.equal(active.session?.userSessionToken, 'user-otp-a')
  assert.deepEqual([...pending.keys()], [`${PENDING_PREFIX}id2`])
  // The first sign-in's code does not work for the second.
  await assert.rejects(finishPending(deps, 'id2', 'code-for-otp-a'), /bad code/)
  assert.equal(active.writes.length, 1)
})

test('a used or expired pending id is rejected', async () => {
  const { deps } = setup()
  await startPending(deps, 'a')
  await finishPending(deps, 'id1', 'code-for-otp-a')
  await assert.rejects(finishPending(deps, 'id1', 'code-for-otp-a'), /expired/)
})

test('a password login without OTP activates directly', async () => {
  const { deps, active } = setup()
  assert.deepEqual(await startPending(deps, 'direct'), { result: 'logged_in' })
  assert.equal(active.session?.userSessionToken, 'direct-token')
})

test('a second code check for the same id is refused while one runs', async () => {
  const { deps, active } = setup()
  await startPending(deps, 'a')
  let release = () => {}
  const original = deps.validateOtp
  deps.validateOtp = async (session, code) => {
    await new Promise<void>((resolve) => {
      release = resolve
    })
    return original(session, code)
  }
  const first = finishPending(deps, 'id1', 'code-for-otp-a')
  await new Promise((resolve) => setImmediate(resolve))
  await assert.rejects(finishPending(deps, 'id1', 'code-for-otp-a'), /already being checked/)
  release()
  await first
  assert.equal(active.writes.length, 1)
})

test('vehicle discovery retries only for a signed-in session with no vehicles', () => {
  const signedIn = { ...emptySession(), userSessionToken: 't' }
  assert.equal(needsVehicleDiscovery(signedIn, 0), true)
  assert.equal(needsVehicleDiscovery(signedIn, 1), false)
  assert.equal(needsVehicleDiscovery(emptySession(), 0), false)
})

test('two code checks started together run validateOtp once', async () => {
  const { deps, active } = setup()
  await startPending(deps, 'a')
  let validations = 0
  const original = deps.validateOtp
  deps.validateOtp = async (session, code) => {
    validations++
    return original(session, code)
  }
  const results = await Promise.allSettled([
    finishPending(deps, 'id1', 'code-for-otp-a'),
    finishPending(deps, 'id1', 'code-for-otp-a'),
  ])
  assert.deepEqual(
    results.map((r) => r.status),
    ['fulfilled', 'rejected'],
  )
  assert.match(String((results[1] as PromiseRejectedResult).reason), /already being checked/)
  assert.equal(validations, 1)
  assert.equal(active.writes.length, 1)
})

function recovery(opts: { failures: number; socket?: boolean }) {
  const calls = { discover: 0, open: 0, fail: 0, clear: 0 }
  let vehicles = 0
  let failures = opts.failures
  const deps: RecoveryDeps = {
    session: async () => ({ ...emptySession(), userSessionToken: 't' }),
    storedVehicleCount: async () => vehicles,
    discoverVehicles: async () => {
      calls.discover++
      if (failures-- > 0) throw new Error('503')
      vehicles = 1
    },
    hasSocket: () => opts.socket ?? false,
    openSocket: async () => void calls.open++,
    clearError: () => void calls.clear++,
    fail: async () => void calls.fail++,
  }
  return { deps, calls }
}

test('recovery: a failed discovery schedules a retry and skips the socket', async () => {
  const { deps, calls } = recovery({ failures: 2 })
  await recoverConnection(deps)
  assert.deepEqual(calls, { discover: 1, open: 0, fail: 1, clear: 0 })
  await recoverConnection(deps)
  assert.deepEqual(calls, { discover: 2, open: 0, fail: 2, clear: 0 })
})

test('recovery: a later alarm stores vehicles, clears the error and opens the socket', async () => {
  const { deps, calls } = recovery({ failures: 1 })
  await recoverConnection(deps)
  await recoverConnection(deps)
  assert.deepEqual(calls, { discover: 2, open: 1, fail: 1, clear: 1 })
  // Vehicles are stored now: no more discovery.
  await recoverConnection(deps)
  assert.equal(calls.discover, 2)
})

test('recovery: an open socket is left alone', async () => {
  const { deps, calls } = recovery({ failures: 0, socket: true })
  await recoverConnection(deps)
  assert.equal(calls.open, 0)
})
