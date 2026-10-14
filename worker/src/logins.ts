// Session isolation for sign-ins that need an OTP. Pure: storage and the Rivian calls are
// injected, so tests run without Workers. A sign-in works on its own pending session. The
// recording session is written only by `activate`, and only after Rivian accepted the login.

import type { Session } from '../../src/rivian-api.ts'
import { isPendingFresh, PENDING_PREFIX, type PendingLogin, pendingToDrop } from './pending.ts'

export interface LoginStore {
  get(key: string): Promise<PendingLogin | undefined>
  put(key: string, value: PendingLogin): Promise<void>
  delete(keys: string | string[]): Promise<unknown>
  list(prefix: string): Promise<Map<string, PendingLogin>>
}

export interface LoginDeps {
  store: LoginStore
  /** Logs in to a fresh session. Returns true when Rivian sent an OTP. */
  login(session: Session, password: string): Promise<boolean>
  validateOtp(session: Session, code: string): Promise<void>
  /** Makes a verified session the recording session. */
  activate(session: Session): Promise<void>
  newSession(): Session
  now(): number
  newId(): string
  /** Pending ids with a code check running. */
  inFlight: Set<string>
}

export type StartResult = { result: 'logged_in' } | { result: 'otp_sent'; pendingId: string }

export async function startPending(deps: LoginDeps, password: string): Promise<StartResult> {
  const session = deps.newSession()
  const needsOtp = await deps.login(session, password)
  if (!needsOtp) {
    await deps.activate(session)
    return { result: 'logged_in' }
  }
  const now = deps.now()
  await deps.store.delete(pendingToDrop(await deps.store.list(PENDING_PREFIX), now))
  const pendingId = deps.newId()
  await deps.store.put(`${PENDING_PREFIX}${pendingId}`, { session, createdAt: now })
  return { result: 'otp_sent', pendingId }
}

/**
 * A wrong code throws and keeps the pending session. Only a verified code activates it.
 * The in-flight mark is taken before the first await, so concurrent calls cannot both pass.
 */
export async function finishPending(deps: LoginDeps, pendingId: string, code: string) {
  if (deps.inFlight.has(pendingId)) throw new Error('This code is already being checked.')
  deps.inFlight.add(pendingId)
  const key = `${PENDING_PREFIX}${pendingId}`
  let session: Session
  try {
    const pending = await deps.store.get(key)
    if (!pending || !isPendingFresh(pending, deps.now())) {
      await deps.store.delete(key)
      throw new Error('This sign-in expired.')
    }
    await deps.validateOtp(pending.session, code)
    await deps.store.delete(key)
    session = pending.session
  } finally {
    deps.inFlight.delete(pendingId)
  }
  await deps.activate(session)
}

/** True when a session exists but vehicle discovery never succeeded. */
export function needsVehicleDiscovery(session: Session, vehicleCount: number): boolean {
  return Boolean(session.userSessionToken) && vehicleCount === 0
}

export interface RecoveryDeps {
  session(): Promise<Session>
  storedVehicleCount(): Promise<number>
  /** Fetches vehicles and stores them. */
  discoverVehicles(session: Session): Promise<void>
  hasSocket(): boolean
  openSocket(): Promise<void>
  clearError(): void
  /** Records the error and schedules a retry. */
  fail(error: unknown): Promise<void>
}

/** The alarm's reconnect step: find vehicles if a login never got them, then open the socket. */
export async function recoverConnection(deps: RecoveryDeps): Promise<void> {
  const session = await deps.session()
  if (needsVehicleDiscovery(session, await deps.storedVehicleCount())) {
    try {
      await deps.discoverVehicles(session)
      deps.clearError()
    } catch (error) {
      await deps.fail(error)
      return
    }
  }
  if (!deps.hasSocket()) await deps.openSocket()
}
