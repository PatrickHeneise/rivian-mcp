#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/server'
import { serveStdio } from '@modelcontextprotocol/server/stdio'
import { z } from 'zod'
import * as rivian from './rivian-api.ts'
import { loadSession, saveSession } from './session.ts'
import { registerQueryTools, text } from './tools.ts'

const session = rivian.emptySession()

function requireAuth() {
  if (!rivian.isAuthenticated(session)) {
    throw new Error('Not logged in. Ask the user to log in to Rivian first.')
  }
}

// ── Vehicle ID resolution ─────────────────────────────────────────────

let cachedVehicleId: string | null = null

async function resolveVehicleId() {
  if (cachedVehicleId) return cachedVehicleId
  const user = await rivian.getUserInfo(session)
  if (!user.vehicles?.length) {
    throw new Error('No vehicles found on your Rivian account.')
  }
  cachedVehicleId = user.vehicles[0].id
  return cachedVehicleId
}

// ── MCP Server ────────────────────────────────────────────────────────

function createServer() {
  const server = new McpServer({
    name: 'rivian',
    version: '1.0.0',
  })

  // ── Auth tools ──────────────────────────────────────────────────────

  server.registerTool(
    'rivian_login',
    {
      description:
        'Sign in to Rivian. If Rivian sends a verification code to your phone or email, submit it with rivian_submit_otp.',
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    async () => {
      const email = process.env.RIVIAN_EMAIL
      const password = process.env.RIVIAN_PASSWORD
      if (!email || !password) {
        return {
          ...text(
            'Rivian credentials are not configured. Set RIVIAN_EMAIL and RIVIAN_PASSWORD in your MCP server settings.',
          ),
          isError: true,
        }
      }

      try {
        await rivian.createCsrfToken(session)
        const { mfa } = await rivian.login(session, email, password)
        saveSession(session)
        cachedVehicleId = null

        if (mfa) {
          return text(
            "A verification code has been sent to your phone or email. Tell me the code and I'll complete the sign-in.",
          )
        }

        return text('Signed in to Rivian.')
      } catch (err) {
        return { ...text(`Couldn't sign in: ${(err as Error).message}`), isError: true }
      }
    },
  )

  server.registerTool(
    'rivian_submit_otp',
    {
      description:
        'Complete Rivian sign-in with the verification code sent to your phone or email.',
      inputSchema: z.object({ otp_code: z.string().describe('The verification code') }),
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    async ({ otp_code }) => {
      const email = process.env.RIVIAN_EMAIL
      if (!email) {
        return { ...text('RIVIAN_EMAIL is not configured.'), isError: true }
      }

      if (!rivian.needsOtp(session)) {
        return { ...text('No verification is pending. Call rivian_login first.'), isError: true }
      }

      try {
        await rivian.validateOtp(session, email, otp_code)
        saveSession(session)
        cachedVehicleId = null
        return text('Signed in to Rivian.')
      } catch (err) {
        return {
          ...text(
            `Verification failed: ${(err as Error).message}. You may need to start over with rivian_login.`,
          ),
          isError: true,
        }
      }
    },
  )

  registerQueryTools(server, {
    session: async () => {
      requireAuth()
      return session
    },
    vehicleId: resolveVehicleId,
  })

  return server
}

// ── Start ─────────────────────────────────────────────────────────────

// A terminal on stdin means a person ran `rivian-mcp`, not an MCP client: run the CLI instead
if (process.stdin.isTTY) {
  await import('./cli.ts')
} else {
  try {
    loadSession(session)
  } catch (err) {
    console.error(
      `[rivian-mcp] Failed to restore session, starting unauthenticated: ${(err as Error).message}`,
    )
  }

  serveStdio(createServer)
}
