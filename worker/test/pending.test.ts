import assert from 'node:assert/strict'
import { test } from 'node:test'
import { emptySession } from '../../src/rivian-api.ts'
import { isPendingFresh, PENDING_MAX, PENDING_TTL_MS, pendingToDrop } from '../src/pending.ts'

const entry = (createdAt: number) => ({ session: emptySession(), createdAt })

test('overlapping sign-ins stay while room remains', () => {
  const entries = new Map([
    ['a', entry(1000)],
    ['b', entry(2000)],
  ])
  assert.deepEqual(pendingToDrop(entries, 3000), [])
})

test('expired sign-ins are dropped', () => {
  const entries = new Map([
    ['old', entry(0)],
    ['new', entry(PENDING_TTL_MS)],
  ])
  assert.deepEqual(pendingToDrop(entries, PENDING_TTL_MS + 1), ['old'])
})

test('the oldest are dropped to make room for one more', () => {
  const entries = new Map(Array.from({ length: PENDING_MAX }, (_, i) => [`k${i}`, entry(i + 1)]))
  assert.deepEqual(pendingToDrop(entries, 100), ['k0'])
})

test('freshness ends at the TTL', () => {
  assert.equal(isPendingFresh(entry(0), PENDING_TTL_MS - 1), true)
  assert.equal(isPendingFresh(entry(0), PENDING_TTL_MS), false)
})
