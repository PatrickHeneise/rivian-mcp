// Time zone of a coordinate and local time formatting. Pure, no I/O.

import tzLookup from 'tz-lookup'

/** IANA time zone at a coordinate, or null when the lookup has none (bad input). */
export function timezoneAt(lat: number, lon: number): string | null {
  try {
    return tzLookup(lat, lon)
  } catch {
    return null
  }
}

/**
 * Local time as ISO 8601 with the UTC offset, e.g. `2026-10-13T14:04:11-06:00`.
 * Falls back to UTC (`Z`) when the time zone is null or unknown to Intl.
 */
export function localIso(ms: number, timezone: string | null): string {
  if (!timezone) return utcIso(ms)
  let parts: Intl.DateTimeFormatPart[]
  try {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'longOffset',
    }).formatToParts(new Date(ms))
  } catch {
    return utcIso(ms)
  }
  const get = (type: Intl.DateTimeFormatPart['type']) =>
    parts.find((p) => p.type === type)?.value ?? ''
  // 'GMT' alone is UTC; otherwise 'GMT-06:00' or 'GMT+05:30'.
  const zone = get('timeZoneName').replace('GMT', '') || '+00:00'
  const offset = zone === '+00:00' ? 'Z' : zone
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}${offset}`
}

/** `YYYY-MM-DD` in the given time zone. */
export function localDate(ms: number, timezone: string | null): string {
  return localIso(ms, timezone).slice(0, 10)
}

/** Short zone label for humans, e.g. `MDT`, or the zone name when it has no abbreviation. */
export function zoneAbbreviation(ms: number, timezone: string | null): string {
  if (!timezone) return 'UTC'
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'short' })
      .formatToParts(new Date(ms))
      .find((p) => p.type === 'timeZoneName')
    return part?.value ?? timezone
  } catch {
    return timezone
  }
}

export function utcIso(ms: number): string {
  return new Date(ms).toISOString().replace('.000Z', 'Z')
}
