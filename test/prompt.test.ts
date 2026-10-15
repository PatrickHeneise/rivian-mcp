import assert from 'node:assert/strict'
import { PassThrough } from 'node:stream'
import { test } from 'node:test'
import type { ReadStream } from 'node:tty'
import { promptSecret } from '../src/prompt.ts'

function terminal(isTTY = true, isRaw = false) {
  const stream = Object.assign(new PassThrough(), {
    isTTY,
    isRaw,
    setRawMode(raw: boolean) {
      this.isRaw = raw
      return this
    },
  })
  const output = new PassThrough()
  let rendered = ''
  output.on('data', (chunk) => {
    rendered += chunk.toString()
  })
  return { stream, output, input: stream as unknown as ReadStream, rendered: () => rendered }
}

test('a pasted secret and newline in one chunk completes without echoing the secret', async () => {
  const io = terminal()
  const result = promptSecret('Password: ', io.input, io.output)
  io.stream.write('pasted-password\r\n')
  assert.equal(await result, 'pasted-password')
  assert.equal(io.rendered(), 'Password: ***************\n')
  assert.equal(io.stream.isRaw, false)
  assert.equal(io.stream.listenerCount('data'), 0)
})

test('secret input handles backspace within pasted chunks and restores prior raw mode', async () => {
  const io = terminal(true, true)
  const result = promptSecret('Code: ', io.input, io.output)
  io.stream.write('1234\u007f')
  io.stream.write('56\n')
  assert.equal(await result, '12356')
  assert.equal(io.stream.isRaw, true)
})

test('non-TTY secret input fails clearly without reading or echoing input', async () => {
  const io = terminal(false)
  await assert.rejects(promptSecret('Password: ', io.input, io.output), /requires a terminal/)
  assert.equal(io.rendered(), '')
  assert.equal(io.stream.listenerCount('data'), 0)
})

test('cancelling a secret prompt restores the terminal and rejects with an abort code', async () => {
  const io = terminal()
  const result = promptSecret('Code: ', io.input, io.output)
  io.stream.write('12\u0003')
  await assert.rejects(result, { code: 'ABORT_ERR' })
  assert.equal(io.stream.isRaw, false)
  assert.equal(io.stream.listenerCount('data'), 0)
})

test('closed input does not leave a secret prompt pending', async () => {
  const io = terminal()
  const result = promptSecret('Code: ', io.input, io.output)
  io.stream.end('12')
  await assert.rejects(result, /Input closed/)
  assert.equal(io.stream.isRaw, false)
})
