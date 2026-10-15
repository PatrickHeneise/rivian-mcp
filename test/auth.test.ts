import assert from 'node:assert/strict'
import { afterEach, mock, test } from 'node:test'
import { emptySession, exportSession, login, validateOtp } from '../src/rivian-api.ts'

afterEach(() => mock.restoreAll())

function reply(data: unknown) {
  mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ data })))
}

test('starting MFA replaces old authenticated state with pending verification', async () => {
  const session = {
    ...emptySession(),
    accessToken: 'old-access',
    refreshToken: 'old-refresh',
    userSessionToken: 'old-user',
  }
  reply({ login: { otpToken: 'pending-otp' } })
  assert.deepEqual(await login(session, 'owner@example.com', 'test-password'), { mfa: true })
  const saved = exportSession(session)
  assert.equal(saved.authenticated, false)
  assert.equal(saved.needsOtp, true)
  assert.equal(saved.accessToken, '')
  assert.equal(saved.refreshToken, '')
  assert.equal(saved.userSessionToken, '')
})

test('successful non-MFA login clears an earlier pending verification', async () => {
  const session = { ...emptySession(), otpToken: 'old-otp' }
  reply({ login: { accessToken: 'access', refreshToken: 'refresh', userSessionToken: 'user' } })
  assert.deepEqual(await login(session, 'owner@example.com', 'test-password'), { mfa: false })
  assert.equal(exportSession(session).authenticated, true)
  assert.equal(exportSession(session).needsOtp, false)
})

test('login does not report success without an access token', async () => {
  reply({ login: {} })
  await assert.rejects(
    login(emptySession(), 'owner@example.com', 'test-password'),
    /no access token/,
  )
})

test('successful OTP authenticates and clears pending verification', async () => {
  const session = { ...emptySession(), otpToken: 'pending' }
  reply({
    loginWithOTP: { accessToken: 'access', refreshToken: 'refresh', userSessionToken: 'user' },
  })
  await validateOtp(session, 'owner@example.com', '123456')
  assert.equal(exportSession(session).authenticated, true)
  assert.equal(exportSession(session).needsOtp, false)
})
