import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { McpServer } from '@modelcontextprotocol/server'
import { emptySession } from '../src/rivian-api.ts'
import { registerQueryTools } from '../src/tools.ts'

test('query tools report unavailable authentication as an MCP tool error', async () => {
  const handlers: (() => Promise<{ isError?: boolean; content: { text: string }[] }>)[] = []
  const server = {
    registerTool(
      _name: string,
      _config: unknown,
      handler: (args: object) => ReturnType<(typeof handlers)[number]>,
    ) {
      handlers.push(() => handler({}))
    },
  } as unknown as McpServer
  registerQueryTools(server, {
    session: async () => {
      throw new Error('Not logged in.')
    },
    vehicleId: async () => 'vehicle',
  })
  assert.equal(handlers.length, 7)
  for (const handler of handlers) {
    const result = await handler()
    assert.equal(result.isError, true)
    assert.equal(result.content[0].text, 'Not logged in.')
  }
})

test('query tools report upstream failures as an MCP tool error', async () => {
  let handler: () => Promise<{ isError?: boolean; content: { text: string }[] }> = async () => {
    throw new Error('not registered')
  }
  const server = {
    registerTool(name: string, _config: unknown, callback: typeof handler) {
      if (name === 'rivian_get_ota_status') handler = callback
    },
  } as unknown as McpServer
  registerQueryTools(server, {
    session: async () => emptySession(),
    vehicleId: async () => {
      throw new Error('No vehicles found.')
    },
  })
  const result = await handler()
  assert.equal(result.isError, true)
  assert.equal(result.content[0].text, 'No vehicles found.')
})
