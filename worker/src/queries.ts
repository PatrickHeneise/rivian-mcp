// SQL for the MCP tools and Apps views. Kept apart so tests can run it on node:sqlite.
// Bucket sizes are cast to INTEGER: a bound JS number can arrive as REAL, and `ts / REAL`
// would put every row in its own group.

/** Binds: from, min drive meters, bucket ms. One point per bucket and drive. */
export const STATS_POINTS_SQL = `SELECT drive_id, MIN(ts) AS ts, lat, lon, alt FROM points
WHERE drive_id IN (SELECT id FROM drives WHERE started_at >= ?1 AND distance_m >= ?2)
GROUP BY drive_id, ts / CAST(?3 AS INTEGER) ORDER BY drive_id, ts`

/**
 * Binds: from, to, bucket ms. One point per bucket for every drive that started in the range,
 * whatever its distance. The drive list reads altitude through this.
 */
export const RANGE_POINTS_SQL = `SELECT drive_id, MIN(ts) AS ts, alt FROM points
WHERE drive_id IN (SELECT id FROM drives WHERE started_at BETWEEN ?1 AND ?2)
GROUP BY drive_id, ts / CAST(?3 AS INTEGER) ORDER BY drive_id, ts`

/**
 * Binds: rvm, from, lookback ms, open-drive span ms, lookahead ms, to. Battery samples near
 * drives that started between `from` and `to`. Drive-led, so each drive is one range lookup
 * on (vehicle_id, ts).
 */
export const DRIVE_WINDOW_SAMPLES_SQL = `SELECT DISTINCT c.vehicle_id, c.ts, c.data
FROM drives d CROSS JOIN charge_samples c ON c.vehicle_id = d.vehicle_id AND c.rvm = ?1
  AND c.ts BETWEEN d.started_at - ?3 AND COALESCE(d.ended_at, d.started_at + ?4) + ?5
WHERE d.started_at BETWEEN ?2 AND ?6
ORDER BY c.ts`

/** Binds: rvm, from, bucket ms. The last pack capacity reading of each bucket, per vehicle. */
export const DAILY_CAPACITY_SQL = `SELECT vehicle_id, MAX(ts) AS ts, json_extract(data, '$.packEnergyKwh') AS kwh
FROM charge_samples
WHERE rvm = ?1 AND ts >= ?2 AND json_extract(data, '$.packEnergyKwh') IS NOT NULL
GROUP BY vehicle_id, ts / CAST(?3 AS INTEGER) ORDER BY vehicle_id, ts`
