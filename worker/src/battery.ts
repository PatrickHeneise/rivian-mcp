// Battery sample reads shared by the tools and the MCP Apps views.

import { RVM_BATTERY } from './parallax.ts'
import { DRIVE_WINDOW_SAMPLES_SQL } from './queries.ts'
import { type BatterySample, SOC_LOOKAHEAD_MS, SOC_LOOKBACK_MS } from './stats.ts'

export const DAY_MS = 86_400_000

export async function batterySamples(
  db: D1Database,
  vehicleId: string,
  from: number,
  to: number,
): Promise<BatterySample[]> {
  const { results } = await db
    .prepare(
      'SELECT ts, data FROM charge_samples WHERE vehicle_id = ? AND rvm = ? AND ts BETWEEN ? AND ? ORDER BY ts',
    )
    .bind(vehicleId, RVM_BATTERY, from, to)
    .all<{ ts: number; data: string }>()
  return results.flatMap(parseBattery)
}

export function parseBattery(r: { ts: number; data: string }): BatterySample[] {
  const data = JSON.parse(r.data) as { socPct?: number; packEnergyKwh?: number }
  if (data.socPct === undefined) return []
  return [{ ts: r.ts, socPct: data.socPct, packEnergyKwh: data.packEnergyKwh ?? null }]
}

/**
 * Battery samples near the drives that started between `from` and `to`, per vehicle, so a
 * long period stays bounded.
 */
export async function driveWindowSamples(
  db: D1Database,
  from: number,
  to: number = Number.MAX_SAFE_INTEGER,
): Promise<Map<string, BatterySample[]>> {
  const { results } = await db
    .prepare(DRIVE_WINDOW_SAMPLES_SQL)
    .bind(RVM_BATTERY, from, SOC_LOOKBACK_MS, DAY_MS, SOC_LOOKAHEAD_MS, to)
    .all<{ vehicle_id: string; ts: number; data: string }>()
  const byVehicle = new Map<string, BatterySample[]>()
  for (const r of results) {
    const list = byVehicle.get(r.vehicle_id) ?? []
    list.push(...parseBattery(r))
    byVehicle.set(r.vehicle_id, list)
  }
  return byVehicle
}
