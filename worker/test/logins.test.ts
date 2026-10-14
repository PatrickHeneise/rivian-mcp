import assert from 'node:assert/strict'
import { test } from 'node:test'
import { emptySession, type Session } from '../../src/rivian-api.ts'
import {
  finishPending,
  type LoginDeps,
  needsVehicleDiscovery,
  ownerEmail,
  type RecoveryDeps,
  recoverConnection,
  sameEmail,
  startPending,
} from '../src/logins.ts'
import { PENDING_PREFIX, type PendingLogin } from '../src/pending.ts'

/** Fake Rivian: each login gets a distinct otpToken; a code is right only for its own token. */
function setup() {
  const pending = new Map<string, PendingLogin>()
  const active: { session: Session | null; email: string | null; writes: Session[] } = {
    session: null,
    email: null,
    writes: [],
  }
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
    login: async (session, _email, password) => {
      if (password === 'direct') {
        session.userSessionToken = 'direct-token'
        return false
      }
      session.otpToken = `otp-${password}`
      return true
    },
    validateOtp: async (session, _email, code) => {
      if (code !== `code-for-${session.otpToken}`) throw new Error('bad code')
      session.userSessionToken = `user-${session.otpToken}`
      session.otpToken = ''
    },
    activate: async (session, email) => {
      active.session = session
      active.email = email
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
  const a = await startPending(deps, 'me@example.com', 'a')
  const b = await startPending(deps, 'me@example.com', 'b')
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
  await startPending(deps, 'me@example.com', 'a')
  await assert.rejects(finishPending(deps, 'id1', 'nope'), /bad code/)
  assert.equal(active.writes.length, 0)
  assert.ok(pending.has(`${PENDING_PREFIX}id1`))
})

test('a right code activates only its own session and keeps the other pending login', async () => {
  const { deps, pending, active } = setup()
  await startPending(deps, 'me@example.com', 'a')
  await startPending(deps, 'me@example.com', 'b')
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
  await startPending(deps, 'me@example.com', 'a')
  await finishPending(deps, 'id1', 'code-for-otp-a')
  await assert.rejects(finishPending(deps, 'id1', 'code-for-otp-a'), /expired/)
})

test('a password login without OTP activates directly', async () => {
  const { deps, active } = setup()
  assert.deepEqual(await startPending(deps, 'me@example.com', 'direct'), { result: 'logged_in' })
  assert.equal(active.session?.userSessionToken, 'direct-token')
})

test('a second code check for the same id is refused while one runs', async () => {
  const { deps, active } = setup()
  await startPending(deps, 'me@example.com', 'a')
  let release = () => {}
  const original = deps.validateOtp
  deps.validateOtp = async (session, email, code) => {
    await new Promise<void>((resolve) => {
      release = resolve
    })
    return original(session, email, code)
  }
  const first = finishPending(deps, 'id1', 'code-for-otp-a')
  await new Promise((resolve) => setImmediate(resolve))
  await assert.rejects(finishPending(deps, 'id1', 'code-for-otp-a'), /already being checked/)
  release()
  await first
  assert.equal(active.writes.length, 1)
})

test('the email typed at sign-in reaches the code check and activation', async () => {
  const { deps, active } = setup()
  const checked: string[] = []
  const original = deps.validateOtp
  deps.validateOtp = async (session, email, code) => {
    checked.push(email)
    return original(session, email, code)
  }
  await startPending(deps, 'me@example.com', 'a')
  await finishPending(deps, 'id1', 'code-for-otp-a')
  assert.deepEqual(checked, ['me@example.com'])
  assert.equal(active.email, 'me@example.com')
})

test('a refused activation leaves no pending entry to retry', async () => {
  const { deps, pending } = setup()
  deps.activate = async () => {
    throw new Error('This server records a different Rivian account.')
  }
  await startPending(deps, 'me@example.com', 'a')
  await assert.rejects(finishPending(deps, 'id1', 'code-for-otp-a'), /different Rivian account/)
  assert.equal(pending.size, 0)
})

test('the owner is RIVIAN_EMAIL when set, else the claimed email, else nobody', () => {
  assert.equal(ownerEmail(' Set@Example.com ', 'claimed@example.com'), 'Set@Example.com')
  assert.equal(ownerEmail(undefined, 'claimed@example.com'), 'claimed@example.com')
  assert.equal(ownerEmail('', 'claimed@example.com'), 'claimed@example.com')
  assert.equal(ownerEmail(undefined, undefined), null)
})

test('emails match ignoring case and surrounding spaces', () => {
  assert.equal(sameEmail(' Me@Example.com ', 'me@example.com'), true)
  assert.equal(sameEmail('me@example.com', 'you@example.com'), false)
})

test('vehicle discovery retries only for a signed-in session with no vehicles', () => {
  const signedIn = { ...emptySession(), userSessionToken: 't' }
  assert.equal(needsVehicleDiscovery(signedIn, 0), true)
  assert.equal(needsVehicleDiscovery(signedIn, 1), false)
  assert.equal(needsVehicleDiscovery(emptySession(), 0), false)
})

test('two code checks started together run validateOtp once', async () => {
  const { deps, active } = setup()
  await startPending(deps, 'me@example.com', 'a')
  let validations = 0
  const original = deps.validateOtp
  deps.validateOtp = async (session, email, code) => {
    validations++
    return original(session, email, code)
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
