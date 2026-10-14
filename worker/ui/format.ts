// Unit conversion and formatting. Data arrives in SI; the view shows imperial or metric.

export type Units = 'imperial' | 'metric'

const MI_PER_KM = 0.621371
const FT_PER_M = 3.28084

export interface Formatter {
  units: Units
  locale: string | undefined
  timeZone: string | undefined
  distance(m: number): [string, string]
  /** Distance in the display unit, unformatted. */
  distanceValue(m: number): number
  speed(mps: number): [string, string]
  /** Speed in the display unit, unformatted. */
  speedValue(mps: number): number
  height(m: number): [string, string]
  /** Height in the display unit, unformatted. */
  heightValue(m: number): number
  /** Imperial: mi/kWh, higher is better. Metric: kWh/100 km, lower is better. */
  efficiency(kmPerKwh: number): [string, string]
  number(n: number, digits?: number): string
  date(ms: number, options: Intl.DateTimeFormatOptions): string
  time(ms: number): string
  duration(ms: number): string
}

/** Imperial for locales that use miles. */
export function defaultUnits(locale: string | undefined): Units {
  return /-(US|LR|MM|GB)\b/i.test(locale ?? '') ? 'imperial' : 'metric'
}

export function formatter(units: Units, locale?: string, timeZone?: string): Formatter {
  const imperial = units === 'imperial'
  const number = (n: number, digits = 0) =>
    n.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits })
  const distanceValue = (m: number) => (imperial ? (m / 1000) * MI_PER_KM : m / 1000)
  const speedValue = (mps: number) => (imperial ? mps * 3.6 * MI_PER_KM : mps * 3.6)
  const heightValue = (m: number) => (imperial ? m * FT_PER_M : m)
  const date = (ms: number, options: Intl.DateTimeFormatOptions) =>
    new Date(ms).toLocaleString(locale, { timeZone, ...options })
  return {
    units,
    locale,
    timeZone,
    number,
    date,
    distanceValue,
    distance(m) {
      const value = distanceValue(m)
      return [number(value, value < 100 ? 1 : 0), imperial ? 'mi' : 'km']
    },
    speedValue,
    speed(mps) {
      return [number(speedValue(mps), 0), imperial ? 'mph' : 'km/h']
    },
    heightValue,
    height(m) {
      return [number(heightValue(m), 0), imperial ? 'ft' : 'm']
    },
    efficiency(kmPerKwh) {
      return imperial
        ? [number(kmPerKwh * MI_PER_KM, 2), 'mi/kWh']
        : [number(100 / kmPerKwh, 1), 'kWh/100 km']
    },
    time(ms) {
      return date(ms, { hour: 'numeric', minute: '2-digit' })
    },
    duration(ms) {
      const minutes = Math.round(ms / 60_000)
      if (minutes < 60) return `${minutes} min`
      const h = Math.floor(minutes / 60)
      const m = minutes % 60
      return m ? `${h} h ${m} min` : `${h} h`
    },
  }
}

/** A day key in the view's time zone, for bucketing drives per day. */
export function dayKey(ms: number, timeZone: string | undefined): string {
  return new Date(ms).toLocaleDateString('en-CA', { timeZone })
}

/** Every calendar day from the day of `from` to the day of `to` in the time zone, as Y-M-D. */
export function dayRange(
  from: number,
  to: number,
  timeZone: string | undefined,
): [number, number, number][] {
  const utcOfDay = (ms: number) => {
    const [y, m, d] = dayKey(ms, timeZone).split('-').map(Number)
    return Date.UTC(y, m - 1, d)
  }
  const days: [number, number, number][] = []
  for (let t = utcOfDay(from); t <= utcOfDay(to); t += 86_400_000) {
    const d = new Date(t)
    days.push([d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()])
  }
  return days
}

export function partOfDay(ms: number, timeZone: string | undefined): string {
  const hour = Number(
    new Date(ms).toLocaleString('en-US', { timeZone, hour: 'numeric', hourCycle: 'h23' }),
  )
  if (hour < 5) return 'Night'
  if (hour < 12) return 'Morning'
  if (hour < 17) return 'Afternoon'
  if (hour < 21) return 'Evening'
  return 'Night'
}
