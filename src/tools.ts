// Live read-only query tools, shared by the stdio server and the Cloudflare Worker.

import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'
import * as format from './format.ts'
import * as rivian from './rivian-api.ts'

/** Where the tools get the Rivian session and vehicle. Both throw a readable error when unset. */
export interface QueryContext {
  session(): Promise<rivian.Session>
  vehicleId(session: rivian.Session): Promise<string>
}

export const READ_ONLY = { readOnlyHint: true, openWorldHint: true }

export function text(str: string) {
  return { content: [{ type: 'text' as const, text: str }] }
}

export function registerQueryTools(server: McpServer, ctx: QueryContext): void {
  // Runs a tool and turns any error into its text response
  const query = async (run: (session: rivian.Session) => Promise<string>) => {
    try {
      return text(await run(await ctx.session()))
    } catch (err) {
      return { ...text((err as Error).message), isError: true }
    }
  }

  server.registerTool(
    'rivian_get_user_info',
    {
      description:
        'Look up your Rivian account — your vehicles, software versions, and account details.',
      annotations: READ_ONLY,
    },
    () => query(async (s) => format.formatUserInfo(await rivian.getUserInfo(s))),
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
      annotations: READ_ONLY,
    },
    ({ properties }) =>
      query(async (s) => {
        const props = properties?.length ? new Set(properties) : undefined
        return format.formatVehicleState(
          await rivian.getVehicleState(s, await ctx.vehicleId(s), props),
        )
      }),
  )

  server.registerTool(
    'rivian_get_ota_status',
    {
      description:
        "Check for software updates — what version you're running and whether a new one is available.",
      annotations: READ_ONLY,
    },
    () =>
      query(async (s) =>
        format.formatOTAStatus(await rivian.getOTAUpdateDetails(s, await ctx.vehicleId(s))),
      ),
  )

  server.registerTool(
    'rivian_get_charging_session',
    {
      description:
        'Check on an active charging session — power, battery level, time remaining, and cost.',
      annotations: READ_ONLY,
    },
    () =>
      query(async (s) => {
        const vehicleId = await ctx.vehicleId(s)
        const live = await rivian.getLiveChargingSession(s, vehicleId)
        // An empty live session does not mean the vehicle is idle; check vehicle state
        const state = live ? null : await rivian.getChargingState(s, vehicleId)
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
      annotations: READ_ONLY,
    },
    ({ limit }) =>
      query(async (s) =>
        format.formatChargingHistory(await rivian.getAllChargingHistory(s), limit ?? 25),
      ),
  )

  server.registerTool(
    'rivian_get_charging_schedule',
    {
      description:
        'See your charging schedule — what times and days your vehicle is set to charge.',
      annotations: READ_ONLY,
    },
    () =>
      query(async (s) =>
        format.formatChargingSchedule(await rivian.getChargingSchedule(s, await ctx.vehicleId(s))),
      ),
  )

  server.registerTool(
    'rivian_get_drivers_and_keys',
    {
      description: 'See who has access to your vehicle — drivers, phone keys, and key fobs.',
      annotations: READ_ONLY,
    },
    () =>
      query(async (s) =>
        format.formatDriversAndKeys(await rivian.getDriversAndKeys(s, await ctx.vehicleId(s))),
      ),
  )
}
