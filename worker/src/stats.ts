// Drive and charging statistics for the MCP Apps views. Pure functions, no I/O.

/** Altitude changes smaller than this count as GPS noise, not climb. */
export const ELEVATION_NOISE_M = 3
/** A battery sample older than this before a drive starts cannot give its start SoC. */
export const SOC_LOOKBACK_MS = 30 * 60_000
/**
 * Without a recent sample before a drive, its start SoC may come from a sample up to this long
 * after it starts. A parked vehicle stops sending battery state while SoC holds steady.
 */
export const SOC_START_GRACE_MS = 2 * 60_000
/** A drive's end SoC may come from a sample up to this long after it ends. */
export const SOC_LOOKAHEAD_MS = 60_000
/** SoC samples further apart than this split two charging sessions. */
export const SESSION_GAP_MS = 20 * 60_000
/** A charging session must add at least this much SoC, so drift is not a session. */
export const SESSION_MIN_SOC_PCT = 1

/** Stats leave out shorter drives: parked GPS drift opens drives that go nowhere. */
export const MIN_DRIVE_M = 200
/** Stats leave out closed drives slower than this on average (3.6 km/h): a drive that never closed. */
export const MIN_AVG_SPEED_MPS = 1

/** True for a drive that is GPS noise rather than driving. Open drives pass the speed check. */
export function isNoise(distanceM: number, durationMs: number | null): boolean {
  if (distanceM < MIN_DRIVE_M) return true
  return (
    durationMs !== null && durationMs > 0 && distanceM / (durationMs / 1000) < MIN_AVG_SPEED_MPS
  )
}

export interface Elevation {
  gainM: number
  lossM: number
  minM: number
  maxM: number
}

/** Climb and descent with a hysteresis of ELEVATION_NOISE_M. Null without altitude data. */
export function elevation(alts: readonly (number | null)[]): Elevation | null {
  const values = alts.filter((a): a is number => a !== null && Number.isFinite(a))
  if (values.length === 0) return null
  let gainM = 0
  let lossM = 0
  let ref = values[0]
  for (const alt of values) {
    const delta = alt - ref
    if (delta >= ELEVATION_NOISE_M) gainM += delta
    else if (delta <= -ELEVATION_NOISE_M) lossM -= delta
    else continue
    ref = alt
  }
  return { gainM, lossM, minM: Math.min(...values), maxM: Math.max(...values) }
}

export interface BatterySample {
  ts: number
  socPct: number
  packEnergyKwh: number | null
}

export interface DriveEnergy {
  socStartPct: number
  socEndPct: number
  energyKwh: number
}

/**
 * Energy a drive used, from the SoC drop times pack capacity. `samples` must be sorted by ts.
 * Start SoC is the last sample at or before the start, or the first sample within
 * SOC_START_GRACE_MS after it when the one before is older than SOC_LOOKBACK_MS. End SoC is the
 * last sample at or before the end plus SOC_LOOKAHEAD_MS. Null when either side has no sample.
 */
export function driveEnergy(
  samples: readonly BatterySample[],
  startedAt: number,
  endedAt: number,
): DriveEnergy | null {
  const start = startSample(samples, startedAt)
  if (!start || start.ts > endedAt) return null
  const end = lastAtOrBefore(samples, endedAt + SOC_LOOKAHEAD_MS)
  const pack = end?.packEnergyKwh ?? start.packEnergyKwh
  if (!end || end.ts <= start.ts || endedAt - end.ts > SOC_LOOKBACK_MS || pack === null) return null
  return {
    socStartPct: start.socPct,
    socEndPct: end.socPct,
    energyKwh: round(((start.socPct - end.socPct) / 100) * pack, 2),
  }
}

/** Kilometers per kWh. Null when the drive used no measurable energy. */
export function efficiencyKmPerKwh(distanceM: number, energyKwh: number | null): number | null {
  if (energyKwh === null || energyKwh <= 0) return null
  return round(distanceM / 1000 / energyKwh, 2)
}

export interface ChargeSession {
  startedAt: number
  endedAt: number
  socStartPct: number
  socEndPct: number
  energyKwh: number
}

/**
 * Charging sessions from battery samples sorted by ts: runs of rising SoC with no gap over
 * SESSION_GAP_MS that add at least SESSION_MIN_SOC_PCT. Uses SoC only, because the charging
 * status enums are not decoded yet.
 */
export function chargeSessions(samples: readonly BatterySample[]): ChargeSession[] {
  const sessions: ChargeSession[] = []
  let run: BatterySample[] = []
  const finish = () => {
    // Trailing samples at the final SoC are the vehicle idling after the charge.
    while (run.length > 1 && run[run.length - 2].socPct === run[run.length - 1].socPct) run.pop()
    const first = run[0]
    const last = run[run.length - 1]
    const pack = last?.packEnergyKwh ?? first?.packEnergyKwh ?? null
    if (first && last && pack !== null && last.socPct - first.socPct >= SESSION_MIN_SOC_PCT) {
      sessions.push({
        startedAt: first.ts,
        endedAt: last.ts,
        socStartPct: first.socPct,
        socEndPct: last.socPct,
        energyKwh: round(((last.socPct - first.socPct) / 100) * pack, 2),
      })
    }
    run = []
  }
  for (const sample of samples) {
    const prev = run[run.length - 1]
    if (prev && (sample.socPct < prev.socPct || sample.ts - prev.ts > SESSION_GAP_MS)) {
      finish()
    }
    // While SoC has not risen yet, keep only the latest sample, so the session starts at the rise.
    if (run.length > 0 && run[0].socPct === sample.socPct) run = []
    run.push(sample)
  }
  finish()
  return sessions
}

/** At most `max` items, evenly spaced, always keeping the first and the last. */
export function downsample<T>(items: readonly T[], max: number): T[] {
  if (items.length <= max) return [...items]
  const step = (items.length - 1) / (max - 1)
  return Array.from({ length: max }, (_, i) => items[Math.round(i * step)])
}

function startSample(samples: readonly BatterySample[], startedAt: number): BatterySample | null {
  const before = lastAtOrBefore(samples, startedAt)
  if (before && startedAt - before.ts <= SOC_LOOKBACK_MS) return before
  const after = samples.find((s) => s.ts > startedAt)
  return after && after.ts - startedAt <= SOC_START_GRACE_MS ? after : null
}

function lastAtOrBefore(samples: readonly BatterySample[], ts: number): BatterySample | null {
  let lo = 0
  let hi = samples.length - 1
  let found: BatterySample | null = null
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (samples[mid].ts <= ts) {
      found = samples[mid]
      lo = mid + 1
    } else hi = mid - 1
  }
  return found
}

export const round = (n: number, digits: number) => Number(n.toFixed(digits))
