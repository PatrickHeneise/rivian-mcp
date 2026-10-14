// Decides which charging messages become rows in charge_samples.

import { RVM_CHARGING_STATUS } from './parallax.ts'

/** Store at most one sample per RVM in this window, except status changes. */
export const SAMPLE_MS = 60_000

export interface LastSample {
  ts: number
  data: string
}

/** True for the first sample, after SAMPLE_MS, and on any change to the charging status. */
export function shouldSample(
  rvm: string,
  last: LastSample | undefined,
  ts: number,
  data: string,
): boolean {
  if (!last) return true
  if (rvm === RVM_CHARGING_STATUS && data !== last.data) return true
  return ts - last.ts >= SAMPLE_MS
}
