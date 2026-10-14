import assert from 'node:assert/strict'
import { test } from 'node:test'
import { esc, merge } from '../src/html.ts'

test('esc escapes & < > " and quotes', () => {
  assert.equal(esc(`&<>"'`), '&#38;&#60;&#62;&#34;&#39;')
})

test('merge keeps every Set-Cookie from both sides', () => {
  const base = new Headers({ 'X-A': '1' })
  base.append('Set-Cookie', 'a=1')
  const extra = new Headers({ 'X-A': '2' })
  extra.append('Set-Cookie', 'b=2')
  extra.append('Set-Cookie', 'c=3')
  const merged = merge(base, extra)
  assert.deepEqual(merged.getSetCookie(), ['a=1', 'b=2', 'c=3'])
  assert.equal(merged.get('X-A'), '2')
})

test('merge works without a base', () => {
  const extra = new Headers()
  extra.append('Set-Cookie', 'b=2')
  assert.deepEqual(merge(undefined, extra).getSetCookie(), ['b=2'])
})
