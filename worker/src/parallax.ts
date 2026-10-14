// Decoders for Rivian Parallax messages: base64-encoded protobuf payloads.
// Field numbers follow bretterer/rivian-python-client parallax.py. GNSS, power and
// odometer were confirmed live on a 2025 R1S (2026-10-09); the charging fields are not
// confirmed yet, so the recorder also stores the raw payloads.

export const RVM_GNSS = 'dynamics.vehicle.gnss'
export const RVM_POWER = 'vehicle.power.state'
export const RVM_ODOMETER = 'dynamics.vehicle.odometer'
export const RVM_CHARGING_STATUS = 'charging.session.status'
export const RVM_CHARGING_TIME = 'charging.session.time_estimation'
export const RVM_BATTERY = 'energy.high_voltage.battery_state'
export const RVM_CHARGE_BREAKDOWN = 'energy_edge_compute.graphs.charge_session_breakdown'
export const CHARGING_RVMS = [
  RVM_CHARGING_STATUS,
  RVM_CHARGING_TIME,
  RVM_BATTERY,
  RVM_CHARGE_BREAKDOWN,
]
export const RVMS = [RVM_GNSS, RVM_POWER, RVM_ODOMETER, ...CHARGING_RVMS]

type Field = { field: number; wire: number; value: number | Uint8Array }

export function readFields(bytes: Uint8Array): Field[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const fields: Field[] = []
  let i = 0
  const varint = (): number => {
    let result = 0
    let scale = 1
    let byte: number
    do {
      byte = bytes[i++]
      result += (byte & 0x7f) * scale
      scale *= 128
    } while (byte & 0x80)
    return result
  }
  while (i < bytes.length) {
    const tag = varint()
    const field = Math.floor(tag / 8)
    const wire = tag & 7
    if (wire === 0) fields.push({ field, wire, value: varint() })
    else if (wire === 1 && i + 8 <= bytes.length) {
      fields.push({ field, wire, value: view.getFloat64(i, true) })
      i += 8
    } else if (wire === 5 && i + 4 <= bytes.length) {
      fields.push({ field, wire, value: view.getFloat32(i, true) })
      i += 4
    } else if (wire === 2) {
      const length = varint()
      if (i + length > bytes.length) break
      fields.push({ field, wire, value: bytes.subarray(i, i + length) })
      i += length
    } else break
  }
  return fields
}

const fromBase64 = (payload: string): Uint8Array =>
  Uint8Array.from(atob(payload), (c) => c.charCodeAt(0))

const numberField = (fields: Field[], field: number, wire: number): number | undefined => {
  const found = fields.find((f) => f.field === field && f.wire === wire)
  return typeof found?.value === 'number' ? found.value : undefined
}

export interface Gnss {
  lat: number
  lon: number
  alt: number | null
  speedMps: number | null
  bearing: number | null
}

/**
 * Fields 1-3 are doubles (lat, lon, altitude m); 4 is speed in m/s and 5 bearing, both floats.
 * Field 6 is the horizontal position error in m, not speed: it grows while parked without a fix.
 */
export function decodeGnss(payload: string): Gnss | null {
  if (!payload) return null
  const fields = readFields(fromBase64(payload))
  const lat = numberField(fields, 1, 1)
  const lon = numberField(fields, 2, 1)
  if (lat === undefined || lon === undefined) return null
  const bearing = numberField(fields, 5, 5)
  return {
    lat,
    lon,
    alt: numberField(fields, 3, 1) ?? null,
    speedMps: numberField(fields, 4, 5) ?? null,
    bearing: bearing === undefined ? null : ((bearing % 360) + 360) % 360,
  }
}

export type PowerState = 'sleep' | 'standby' | 'ready' | 'go'
const POWER_STATES: Record<number, PowerState> = { 1: 'sleep', 2: 'standby', 3: 'ready', 4: 'go' }

export function decodePowerState(payload: string): PowerState | null {
  if (!payload) return null
  const value = numberField(readFields(fromBase64(payload)), 1, 0)
  return value === undefined ? null : (POWER_STATES[value] ?? 'standby')
}

/** Field 1 is the odometer in whole km. */
export function decodeOdometerKm(payload: string): number | null {
  if (!payload) return null
  return numberField(readFields(fromBase64(payload)), 1, 0) ?? null
}

export type ChargingData = Record<string, number>

const round = (n: number, digits: number) => Number(n.toFixed(digits))

/** Drops undefined values, so a missing field never appears as a key. */
function defined(data: Record<string, number | undefined>): ChargingData {
  return Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)) as ChargingData
}

/**
 * Decodes a charging RVM payload. Returns null for an unknown RVM or an empty payload.
 * - status: 1 plug connection, 2 display status, 3 EVSE type (enums, meanings unknown)
 * - time estimation: 2 seconds to end of charge (live on a 2025 R1S, 2026-10-10);
 *   upstream reads 1, kept as a fallback
 * - battery state: nested message 1 with 1 SoC % and 2 pack kWh (doubles), 3 range km (float)
 * - charge session breakdown: 1 total kWh and 9 power kW (floats), 13 charging state enum;
 *   10 is an integer power that upstream uses when 9 is missing
 */
export function decodeCharging(rvm: string, payload: string): ChargingData | null {
  if (!payload || !CHARGING_RVMS.includes(rvm)) return null
  const fields = readFields(fromBase64(payload))
  if (rvm === RVM_CHARGING_STATUS) {
    return defined({
      plugConnectionStatus: numberField(fields, 1, 0),
      displayStatus: numberField(fields, 2, 0),
      evseType: numberField(fields, 3, 0),
    })
  }
  if (rvm === RVM_CHARGING_TIME) {
    return defined({ timeToEndOfChargeS: numberField(fields, 2, 0) ?? numberField(fields, 1, 0) })
  }
  if (rvm === RVM_BATTERY) {
    const nested = fields.find((f) => f.field === 1 && f.wire === 2)?.value
    if (!(nested instanceof Uint8Array)) return {}
    const inner = readFields(nested)
    const soc = numberField(inner, 1, 1)
    const pack = numberField(inner, 2, 1)
    const range = numberField(inner, 3, 5)
    return defined({
      socPct: soc === undefined ? undefined : round(soc, 2),
      packEnergyKwh: pack === undefined ? undefined : round(pack, 2),
      rangeKm: range === undefined ? undefined : round(range, 1),
    })
  }
  const total = numberField(fields, 1, 5)
  const power = numberField(fields, 9, 5) ?? numberField(fields, 10, 0)
  return defined({
    totalKwh: total === undefined ? undefined : round(total, 3),
    powerKw: power === undefined ? undefined : round(power, 2),
    chargingState: numberField(fields, 13, 0),
  })
}
