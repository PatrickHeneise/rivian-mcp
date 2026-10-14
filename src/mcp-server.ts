#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/server'
import { serveStdio } from '@modelcontextprotocol/server/stdio'
import { z } from 'zod'
import * as format from './format.ts'
import * as rivian from './rivian-api.ts'
import { loadSession, saveSession } from './session.ts'

function text(str: string) {
  return { content: [{ type: 'text' as const, text: str }] }
}

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

// Runs a read-only tool and turns any error into its text response
async function query(run: () => Promise<string>) {
  try {
    requireAuth()
    return text(await run())
  } catch (err) {
    return text((err as Error).message)
  }
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
        'Log in to your Rivian account. Rivian will send a verification code to your phone or email — use rivian_submit_otp to complete sign-in.',
    },
    async () => {
      const email = process.env.RIVIAN_EMAIL
      const password = process.env.RIVIAN_PASSWORD
      if (!email || !password) {
        return text(
          'Rivian credentials are not configured. Set RIVIAN_EMAIL and RIVIAN_PASSWORD in your MCP server settings.',
        )
      }

      try {
        await rivian.createCsrfToken(session)
        const { mfa } = await rivian.login(session, email, password)
        saveSession(session)

        if (mfa) {
          return text(
            "A verification code has been sent to your phone or email. Tell me the code and I'll complete the sign-in.",
          )
        }

        return text('Signed in to Rivian successfully.')
      } catch (err) {
        return text(`Couldn't sign in: ${(err as Error).message}`)
      }
    },
  )

  server.registerTool(
    'rivian_submit_otp',
    {
      description:
        'Complete Rivian sign-in with the verification code sent to your phone or email.',
      inputSchema: z.object({ otp_code: z.string().describe('The verification code') }),
    },
    async ({ otp_code }) => {
      const email = process.env.RIVIAN_EMAIL
      if (!email) {
        return text('RIVIAN_EMAIL is not configured.')
      }

      if (!rivian.needsOtp(session)) {
        return text('No pending verification. Start with rivian_login first.')
      }

      try {
        await rivian.validateOtp(session, email, otp_code)
        saveSession(session)
        return text('Signed in to Rivian successfully.')
      } catch (err) {
        return text(
          `Verification failed: ${(err as Error).message}. You may need to start over with rivian_login.`,
        )
      }
    },
  )

  // ── Read-only query tools ───────────────────────────────────────────

  server.registerTool(
    'rivian_get_user_info',
    {
      description:
        'Look up your Rivian account — your vehicles, software versions, and account details.',
    },
    () => query(async () => format.formatUserInfo(await rivian.getUserInfo(session))),
  )

  server.registerTool(
    'rivian_get_vehicle_state',
    {
      description:
        "Check your vehicle's current status — battery, range, doors, windows, tires, location, climate, seat heat/vent, steering wheel heat, software versions, security, trailer status, and more.",
      inputSchema: z.object({
        properties: z
          .array(z.string())
          .optional()
          .describe('Specific properties to check. Leave empty for a full status report.'),
      }),
    },
    ({ properties }) =>
      query(async () => {
        const vehicleId = await resolveVehicleId()
        const props = properties?.length ? new Set(properties) : undefined
        return format.formatVehicleState(await rivian.getVehicleState(session, vehicleId, props))
      }),
  )

  server.registerTool(
    'rivian_get_ota_status',
    {
      description:
        "Check for software updates — what version you're running and whether a new one is available.",
    },
    () =>
      query(async () => {
        const vehicleId = await resolveVehicleId()
        return format.formatOTAStatus(await rivian.getOTAUpdateDetails(session, vehicleId))
      }),
  )

  server.registerTool(
    'rivian_get_charging_session',
    {
      description:
        'Check on an active charging session — power, battery level, time remaining, and cost.',
    },
    () =>
      query(async () => {
        const vehicleId = await resolveVehicleId()
        const live = await rivian.getLiveChargingSession(session, vehicleId)
        // An empty live session does not mean the vehicle is idle; check vehicle state
        const state = live ? null : await rivian.getChargingState(session, vehicleId)
        return format.formatChargingSession(live, state)
      }),
  )

  server.registerTool(
    'rivian_get_charging_history',
    {
      description:
        'View past charging sessions, newest first — energy, cost, duration, and location for each charge.',
      inputSchema: z.object({
        limit: z
          .number()
          .int()
          .positive()
          .optional()
          .describe('Number of newest sessions to show. Defaults to 25.'),
      }),
    },
    ({ limit }) =>
      query(async () =>
        format.formatChargingHistory(await rivian.getAllChargingHistory(session), limit ?? 25),
      ),
  )

  server.registerTool(
    'rivian_get_charging_schedule',
    {
      description:
        'See your charging schedule — what times and days your vehicle is set to charge.',
    },
    () =>
      query(async () => {
        const vehicleId = await resolveVehicleId()
        return format.formatChargingSchedule(await rivian.getChargingSchedule(session, vehicleId))
      }),
  )

  server.registerTool(
    'rivian_get_drivers_and_keys',
    {
      description: 'See who has access to your vehicle — drivers, phone keys, and key fobs.',
    },
    () =>
      query(async () => {
        const vehicleId = await resolveVehicleId()
        return format.formatDriversAndKeys(await rivian.getDriversAndKeys(session, vehicleId))
      }),
  )

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
