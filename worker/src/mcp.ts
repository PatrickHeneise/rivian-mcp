// MCP tools. All read only. Sign-in happens on the OAuth consent page in oauth.ts.

import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'
import { registerQueryTools, text } from '../../src/tools.ts'

/** get_drive returns at most this many points so the result fits a model context. */
const MAX_TRACK_POINTS = 500

export interface DriveRow {
  id: string
  vehicle_id: string
  started_at: number
  ended_at: number | null
  start_lat: number
  start_lon: number
  end_lat: number
  end_lon: number
  start_odometer_km: number | null
  end_odometer_km: number | null
  distance_m: number
  max_speed_mps: number
  point_count: number
}

const recorder = (env: Env) => env.RECORDER.get(env.RECORDER.idFromName('default'))
export const km = (m: number) => `${(m / 1000).toFixed(1)} km`
const kmh = (mps: number) => `${Math.round(mps * 3.6)} km/h`
export const iso = (ms: number) => new Date(ms).toISOString().replace('.000Z', 'Z')

function summary(d: DriveRow): string {
  const minutes = d.ended_at ? Math.round((d.ended_at - d.started_at) / 60_000) : null
  return [
    `${d.id}`,
    `  ${iso(d.started_at)} -> ${d.ended_at ? iso(d.ended_at) : 'in progress'}${minutes === null ? '' : ` (${minutes} min)`}`,
    `  ${km(d.distance_m)}, max ${kmh(d.max_speed_mps)}, ${d.point_count} points`,
  ].join('\n')
}

export function registerTools(server: McpServer, env: Env): void {
  registerQueryTools(server, {
    session: async () => (await recorder(env).rivianSession()).session,
    vehicleId: async () => {
      const [vehicle] = (await recorder(env).rivianSession()).vehicles
      if (!vehicle) throw new Error('No vehicles found on your Rivian account.')
      return vehicle.id
    },
  })

  server.registerTool(
    'recorder_status',
    {
      description: 'Show whether the recorder is logged in and connected, and any open drive.',
      annotations: { readOnlyHint: true },
    },
    async () => {
      const s = await recorder(env).status()
      const lines = [
        `Logged in: ${s.loggedIn ? 'yes' : 'no, reconnect the Rivian connector'}`,
        `Connected: ${s.connected ? 'yes' : 'no'}`,
        `Vehicles: ${s.vehicles.map((v) => v.name ?? v.model).join(', ') || 'none'}`,
        `Last message: ${s.lastMessageAt ? iso(s.lastMessageAt) : 'none since restart'}`,
        ...s.openDrives.map((d) => `Open drive: since ${iso(d.startedAt)}, ${km(d.distanceM)}`),
      ]
      if (s.lastError) lines.push(`Last error: ${s.lastError}`)
      return text(lines.join('\n'))
    },
  )

  server.registerTool(
    'list_drives',
    {
      description: 'List recorded drives, newest first.',
      inputSchema: z.object({
        limit: z.number().int().min(1).max(100).default(20),
        since: z
          .string()
          .date()
          .optional()
          .describe('Only drives on or after this date (YYYY-MM-DD)'),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ limit, since }) => {
      const sinceMs = since ? Date.parse(`${since}T00:00:00Z`) : 0
      const { results } = await env.DB.prepare(
        'SELECT * FROM drives WHERE started_at >= ? ORDER BY started_at DESC LIMIT ?',
      )
        .bind(sinceMs, limit)
        .all<DriveRow>()
      if (results.length === 0) return text('No drives recorded.')
      const total = results.reduce((sum, d) => sum + d.distance_m, 0)
      return text(`${results.length} drives, ${km(total)}\n\n${results.map(summary).join('\n\n')}`)
    },
  )

  server.registerTool(
    'get_drive',
    {
      description: `Get one drive with its route as a GeoJSON LineString (at most ${MAX_TRACK_POINTS} points).`,
      inputSchema: z.object({ id: z.string().describe('Drive id from list_drives') }),
      annotations: { readOnlyHint: true },
    },
    async ({ id }) => {
      const drive = await env.DB.prepare('SELECT * FROM drives WHERE id = ?')
        .bind(id)
        .first<DriveRow>()
      if (!drive) return text(`No drive with id ${id}.`)
      const { results } = await env.DB.prepare(
        'SELECT lon, lat FROM points WHERE drive_id = ? ORDER BY ts',
      )
        .bind(id)
        .all<{ lon: number; lat: number }>()
      const step = Math.ceil(results.length / MAX_TRACK_POINTS)
      const track = results.filter((_, i) => i % step === 0 || i === results.length - 1)
      const geojson = {
        type: 'Feature',
        properties: { id: drive.id, startedAt: drive.started_at, endedAt: drive.ended_at },
        geometry: { type: 'LineString', coordinates: track.map((p) => [p.lon, p.lat]) },
      }
      return text(`${summary(drive)}\n\n${JSON.stringify(geojson)}`)
    },
  )
}
