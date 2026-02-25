#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import * as rivian from './lib/rivian-api.js'
import * as format from './lib/format.js'
import { loadSession, saveSession } from './lib/session.js'

// ── CLI passthrough ───────────────────────────────────────────────────

if (process.stdin.isTTY) {
  const __dirname = dirname(fileURLToPath(import.meta.url))
  try {
    execFileSync(process.execPath, [join(__dirname, 'cli.js'), ...process.argv.slice(2)], {
      stdio: 'inherit',
    })
  } catch (err) {
    process.exit(err.status ?? 1)
  }
  process.exit(0)
}

function text(str) {
  return { content: [{ type: 'text', text: str }] }
}

function requireAuth() {
  if (!rivian.isAuthenticated()) {
    throw new Error('Not logged in. Ask the user to log in to Rivian first.')
  }
}

// ── Vehicle ID resolution ─────────────────────────────────────────────

let cachedVehicleId = null

async function resolveVehicleId() {
  if (cachedVehicleId) return cachedVehicleId
  const user = await rivian.getUserInfo()
  if (!user.vehicles?.length) {
    throw new Error('No vehicles found on your Rivian account.')
  }
  cachedVehicleId = user.vehicles[0].id
  return cachedVehicleId
}

// ── Restore session on startup ────────────────────────────────────────

try {
  loadSession(rivian)
} catch (err) {
  console.error(`[rivian-mcp] Failed to restore session, starting unauthenticated: ${err.message}`)
}

// ── MCP Server ────────────────────────────────────────────────────────

const server = new McpServer({
  name: 'rivian',
  version: '1.0.0',
})

// ── Auth tools ────────────────────────────────────────────────────────

server.tool(
  'rivian_login',
  'Log in to your Rivian account. Rivian will send a verification code to your phone or email — use rivian_submit_otp to complete sign-in.',
  {},
  async () => {
    const email = process.env.RIVIAN_EMAIL
    const password = process.env.RIVIAN_PASSWORD
    if (!email || !password) {
      return text(
        'Rivian credentials are not configured. Set RIVIAN_EMAIL and RIVIAN_PASSWORD in your MCP server settings.',
      )
    }

    try {
      await rivian.createCsrfToken()
      const { mfa } = await rivian.login(email, password)
      saveSession(rivian)

      if (mfa) {
        return text(
          "A verification code has been sent to your phone or email. Tell me the code and I'll complete the sign-in.",
        )
      }

      return text('Signed in to Rivian successfully.')
    } catch (err) {
      return text(`Couldn't sign in: ${err.message}`)
    }
  },
)

server.tool(
  'rivian_submit_otp',
  'Complete Rivian sign-in with the verification code sent to your phone or email.',
  { otp_code: z.string().describe('The verification code') },
  async ({ otp_code }) => {
    const email = process.env.RIVIAN_EMAIL
    if (!email) {
      return text('RIVIAN_EMAIL is not configured.')
    }

    if (!rivian.needsOtp()) {
      return text('No pending verification. Start with rivian_login first.')
    }

    try {
      await rivian.validateOtp(email, otp_code)
      saveSession(rivian)
      return text('Signed in to Rivian successfully.')
    } catch (err) {
      return text(
        `Verification failed: ${err.message}. You may need to start over with rivian_login.`,
      )
    }
  },
)

// ── Read-only query tools ─────────────────────────────────────────────

server.tool(
  'rivian_get_user_info',
  'Look up your Rivian account — your vehicles, software versions, and account details.',
  {},
  async () => {
    try {
      requireAuth()
      return text(format.formatUserInfo(await rivian.getUserInfo()))
    } catch (err) {
      return text(err.message)
    }
  },
)

server.tool(
  'rivian_get_vehicle_state',
  "Check your vehicle's current status — battery, range, doors, tires, location, climate, software, and more.",
  {
    properties: z
      .array(z.string())
      .optional()
      .describe('Specific properties to check. Leave empty for a full status report.'),
  },
  async ({ properties }) => {
    try {
      requireAuth()
      const vehicleId = await resolveVehicleId()
      const props = properties?.length ? new Set(properties) : undefined
      return text(format.formatVehicleState(await rivian.getVehicleState(vehicleId, props)))
    } catch (err) {
      return text(err.message)
    }
  },
)

server.tool(
  'rivian_get_ota_status',
  "Check for software updates — what version you're running and whether a new one is available.",
  {},
  async () => {
    try {
      requireAuth()
      const vehicleId = await resolveVehicleId()
      return text(format.formatOTAStatus(await rivian.getOTAUpdateDetails(vehicleId)))
    } catch (err) {
      return text(err.message)
    }
  },
)

server.tool(
  'rivian_get_charging_session',
  'Check on an active charging session — power, battery level, time remaining, and cost.',
  {},
  async () => {
    try {
      requireAuth()
      const vehicleId = await resolveVehicleId()
      return text(format.formatChargingSession(await rivian.getLiveChargingSession(vehicleId)))
    } catch (err) {
      return text(err.message)
    }
  },
)

server.tool(
  'rivian_get_charging_history',
  'View past charging sessions — energy, cost, duration, and location for every charge.',
  {},
  async () => {
    try {
      requireAuth()
      return text(format.formatChargingHistory(await rivian.getChargingHistory()))
    } catch (err) {
      return text(err.message)
    }
  },
)

server.tool(
  'rivian_get_charging_schedule',
  'See your charging schedule — what times and days your vehicle is set to charge.',
  {},
  async () => {
    try {
      requireAuth()
      const vehicleId = await resolveVehicleId()
      return text(format.formatChargingSchedule(await rivian.getChargingSchedule(vehicleId)))
    } catch (err) {
      return text(err.message)
    }
  },
)

server.tool(
  'rivian_get_drivers_and_keys',
  'See who has access to your vehicle — drivers, phone keys, and key fobs.',
  {},
  async () => {
    try {
      requireAuth()
      const vehicleId = await resolveVehicleId()
      return text(format.formatDriversAndKeys(await rivian.getDriversAndKeys(vehicleId)))
    } catch (err) {
      return text(err.message)
    }
  },
)

// ── Start ─────────────────────────────────────────────────────────────

const transport = new StdioServerTransport()
await server.connect(transport)
