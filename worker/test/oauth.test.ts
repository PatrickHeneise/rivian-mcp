import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { OAuthHelpers } from '@cloudflare/workers-oauth-provider'
import './support/cloudflare-stub.ts'

const { handleAuthorize } = await import('../src/oauth.ts')

const OWNER = 'owner@example.com'

function setup(
  opts: { limited?: boolean; start?: object; finishError?: Error; owner?: string | null } = {},
) {
  const calls: string[] = []
  const recorder = {
    ownerEmail: async () => (opts.owner === undefined ? OWNER : opts.owner),
    startPendingLogin: async (email: string) => {
      calls.push(`startPendingLogin ${email}`)
      return opts.start ?? { result: 'otp_sent', pendingId: 'p1' }
    },
    finishPendingLogin: async () => {
      calls.push('finishPendingLogin')
      if (opts.finishError) throw opts.finishError
    },
  }
  const env = {
    RECORDER: { idFromName: () => 'id', get: () => recorder },
    LOGIN_LIMITER: { limit: async () => ({ success: !opts.limited }) },
  }
  const authRequest = { clientId: 'c' }
  const oauth = {
    describeConsent: async () => ({
      clientName: 'Claude',
      clientDomain: 'claude.ai',
      redirectIsLoopback: false,
      redirectHost: 'claude.ai',
    }),
    beginConsent: async () => ({ handle: 'h', headers: new Headers() }),
    approveConsent: async () => ({ request: authRequest, headers: new Headers() }),
    denyConsent: async () => ({ headers: new Headers({ Location: 'https://claude.ai/denied' }) }),
    beginUpstream: async () => ({ state: 's', headers: new Headers() }),
    finishUpstream: async () => ({ request: authRequest, data: 'p1', headers: new Headers() }),
    completeAuthorization: async () => ({ redirectTo: 'https://claude.ai/callback' }),
  }
  const post = (path: string, fields: Record<string, string>) =>
    handleAuthorize(
      new Request(`https://worker.test${path}`, {
        method: 'POST',
        body: new URLSearchParams(fields),
      }),
      env as never,
      oauth as unknown as OAuthHelpers,
    )
  return { calls, post }
}

const password = (email: string) => ({
  handle: 'h',
  decision: 'approve',
  email,
  password: 'pw',
})

test('a wrong email is rejected without calling Rivian', async () => {
  const t = setup()
  const res = await t.post('/authorize', password('other@example.com'))
  assert.equal(res.status, 200)
  assert.match(await res.text(), /records a different Rivian account/)
  assert.deepEqual(t.calls, [])
})

test('a wrong email counts against the rate limit', async () => {
  const t = setup({ limited: true })
  const res = await t.post('/authorize', password('other@example.com'))
  assert.equal(res.status, 429)
})

test('a throttled sign-in does not call Rivian', async () => {
  const t = setup({ limited: true })
  const res = await t.post('/authorize', password(OWNER))
  assert.equal(res.status, 429)
  assert.deepEqual(t.calls, [])
})

test('the owner email is matched ignoring case and spaces, and asks for the code', async () => {
  const t = setup()
  const res = await t.post('/authorize', password(` ${OWNER.toUpperCase()} `))
  assert.match(await res.text(), /Enter your Rivian code/)
  assert.deepEqual(t.calls, [`startPendingLogin  ${OWNER.toUpperCase()} `])
})

test('with no owner yet, any email reaches Rivian to claim the server', async () => {
  const t = setup({ owner: null })
  const res = await t.post('/authorize', password('new@example.com'))
  assert.match(await res.text(), /Enter your Rivian code/)
  assert.deepEqual(t.calls, ['startPendingLogin new@example.com'])
})

test('a login without a code completes the authorization', async () => {
  const t = setup({ start: { result: 'logged_in' } })
  const res = await t.post('/authorize', password(OWNER))
  assert.equal(res.status, 302)
  assert.equal(res.headers.get('Location'), 'https://claude.ai/callback')
})

test('a denied consent redirects without calling Rivian', async () => {
  const t = setup()
  const res = await t.post('/authorize', { handle: 'h', decision: 'deny' })
  assert.equal(res.status, 302)
  assert.deepEqual(t.calls, [])
})

test('a wrong code shows the error and stays on the code page', async () => {
  const t = setup({ finishError: new Error('bad code') })
  const res = await t.post('/authorize/otp?state=s', { code: '123456' })
  assert.equal(res.status, 200)
  assert.match(await res.text(), /Rivian rejected the sign-in: bad code/)
})

test('a malformed code never reaches Rivian', async () => {
  const t = setup()
  const res = await t.post('/authorize/otp?state=s', { code: 'abc' })
  assert.match(await res.text(), /Enter the code from Rivian/)
  assert.deepEqual(t.calls, [])
})

test('a throttled code check never reaches Rivian', async () => {
  const t = setup({ limited: true })
  const res = await t.post('/authorize/otp?state=s', { code: '123456' })
  assert.match(await res.text(), /Too many attempts/)
  assert.deepEqual(t.calls, [])
})

test('a right code completes the authorization', async () => {
  const t = setup()
  const res = await t.post('/authorize/otp?state=s', { code: '123456' })
  assert.equal(res.status, 302)
  assert.deepEqual(t.calls, ['finishPendingLogin'])
})
