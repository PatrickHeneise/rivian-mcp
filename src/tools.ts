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

/** A tool response that reports a failure to the client. */
export function errorText(str: string) {
  return { ...text(str), isError: true }
}

export function registerQueryTools(server: McpServer, ctx: QueryContext): void {
  // Return query failures as MCP tool errors.
  const query = async (run: (session: rivian.Session) => Promise<string>) => {
    try {
      return text(await run(await ctx.session()))
    } catch (err) {
      return errorText((err as Error).message)
    }
  }

  server.registerTool(
    'rivian_get_user_info',
    {
      description: 'Get your account details, vehicles and software versions.',
      annotations: READ_ONLY,
    },
    () => query(async (s) => format.formatUserInfo(await rivian.getUserInfo(s))),
  )

  server.registerTool(
    'rivian_get_vehicle_state',
    {
      description:
        'Get vehicle state: battery, range, doors, windows, tires, location, climate, seat heating and ventilation, steering wheel heat, software versions, security and trailer status.',
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
      description: 'Get the installed software version and any available update.',
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
        'Get the active charging session, including available power, battery level, time remaining and cost.',
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
      description: 'List charging history newest first, with energy, cost, duration and location.',
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
      description: 'Get the days and times your vehicle is scheduled to charge.',
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
      description: 'List drivers, phone keys and key fobs with access to your vehicle.',
      annotations: READ_ONLY,
    },
    () =>
      query(async (s) =>
        format.formatDriversAndKeys(await rivian.getDriversAndKeys(s, await ctx.vehicleId(s))),
      ),
  )
}
