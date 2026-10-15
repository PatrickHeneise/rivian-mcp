import assert from 'node:assert/strict'
import { afterEach, mock, test } from 'node:test'
import { emptySession, getUserInfo } from '../src/rivian-api.ts'

afterEach(() => mock.restoreAll())

test('Rivian requests supply a bounded abort signal', async () => {
  const controller = new AbortController()
  const timeout = mock.method(AbortSignal, 'timeout', () => controller.signal)
  const fetch = mock.method(globalThis, 'fetch', async (_url: unknown, options: RequestInit) => {
    assert.equal(options.signal, controller.signal)
    return new Response(JSON.stringify({ data: { currentUser: { firstName: 'Test' } } }))
  })
  const result = await getUserInfo(emptySession())
  assert.equal(result.firstName, 'Test')
  assert.deepEqual(timeout.mock.calls[0].arguments, [30_000])
  assert.equal(fetch.mock.callCount(), 1)
})

test('an aborted Rivian request fails with a useful error and is not retried', async () => {
  const controller = new AbortController()
  mock.method(AbortSignal, 'timeout', () => controller.signal)
  const fetch = mock.method(globalThis, 'fetch', async (_url: unknown, options: RequestInit) => {
    return new Promise<Response>((_resolve, reject) => {
      options.signal?.addEventListener('abort', () => reject(options.signal?.reason), {
        once: true,
      })
    })
  })
  const request = getUserInfo(emptySession())
  controller.abort(new DOMException('Request timed out', 'TimeoutError'))
  await assert.rejects(request, /Network error contacting Rivian API: Request timed out/)
  assert.equal(fetch.mock.callCount(), 1)
})
