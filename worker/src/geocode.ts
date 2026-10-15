// Reverse geocoding of drive start and end points through Photon (komoot), cached in D1.
// Only settlement-level names leave this module: a drive often starts at home, so the label
// never carries a street, house number or building name.

/** Photon's public endpoint. Coordinates are rounded to 3 decimals (about 100 m) before the request. */
export const PHOTON_REVERSE_URL = 'https://photon.komoot.io/reverse'
const TIMEOUT_MS = 5_000
/** Parallel geocoder requests per tool call. */
const CONCURRENCY = 4
/** D1 allows 100 bound parameters per statement. */
const KEYS_PER_SELECT = 50

export interface PlaceInfo {
  /** Human label without street detail, e.g. `Table Mesa, Boulder, Colorado`. */
  label: string
  /** Neighborhood, suburb or hamlet when the geocoder knows one. */
  neighborhood: string | null
  city: string | null
  region: string | null
  country: string | null
  /** ISO 3166-1 alpha-2, upper case. */
  countryCode: string | null
}

interface PhotonProperties {
  name?: string
  osm_key?: string
  osm_value?: string
  street?: string
  housenumber?: string
  district?: string
  locality?: string
  city?: string
  county?: string
  state?: string
  country?: string
  countrycode?: string
}

interface PhotonResponse {
  features?: { properties?: PhotonProperties }[]
}

const NEIGHBORHOOD_VALUES = new Set(['suburb', 'neighbourhood', 'quarter', 'borough'])
const CITY_VALUES = new Set(['city', 'town', 'village', 'hamlet', 'municipality'])

/** Longest place name kept. OSM names are short; anything longer is not a name. */
const MAX_NAME_LENGTH = 80

/**
 * A geocoder string as plain text: one line, no control characters, bounded length. The
 * names come from OpenStreetMap and end up in text a model reads, so they are data only.
 */
function cleanName(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  let plain = ''
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0
    const control =
      code < 0x20 || (code >= 0x7f && code <= 0x9f) || code === 0x2028 || code === 0x2029
    plain += control ? ' ' : ch
  }
  const text = plain.replace(/\s+/g, ' ').trim()
  if (!text) return undefined
  return text.length > MAX_NAME_LENGTH ? `${text.slice(0, MAX_NAME_LENGTH - 1)}…` : text
}

/** Place info from a Photon reverse response. Null when it has no feature. */
export function parsePhotonReverse(json: unknown): PlaceInfo | null {
  const raw = (json as PhotonResponse)?.features?.[0]?.properties
  if (!raw || typeof raw !== 'object') return null
  const props: PhotonProperties = {
    osm_key: cleanName(raw.osm_key),
    osm_value: cleanName(raw.osm_value),
    name: cleanName(raw.name),
    district: cleanName(raw.district),
    locality: cleanName(raw.locality),
    city: cleanName(raw.city),
    county: cleanName(raw.county),
    state: cleanName(raw.state),
    country: cleanName(raw.country),
    countrycode: cleanName(raw.countrycode)?.slice(0, 2),
  }
  const isPlace = props.osm_key === 'place'
  const neighborhood =
    props.district ??
    props.locality ??
    (isPlace && props.osm_value && NEIGHBORHOOD_VALUES.has(props.osm_value) ? props.name : null) ??
    null
  const city =
    props.city ??
    (isPlace && props.osm_value && CITY_VALUES.has(props.osm_value) ? props.name : null) ??
    null
  const region = props.state ?? null
  const country = props.country ?? null
  const parts: string[] = []
  for (const part of [neighborhood, city ?? props.county ?? null, region]) {
    if (part && !parts.includes(part)) parts.push(part)
  }
  if (parts.length === 0 && country) parts.push(country)
  if (parts.length === 0) return null
  return {
    label: parts.join(', '),
    neighborhood,
    city,
    region,
    country,
    countryCode: props.countrycode?.toUpperCase() ?? null,
  }
}

/** Cache key: the coordinate rounded to about 100 m. */
export function geocodeKey(lat: number, lon: number): string {
  return `${lat.toFixed(3)},${lon.toFixed(3)}`
}

export type Fetch = (input: string, init?: RequestInit) => Promise<Response>

/**
 * Place info for each coordinate, from the D1 cache first and Photon for the rest. Misses are
 * cached too, so an unmapped coordinate is asked about once. Keyed by `geocodeKey`.
 */
export async function reverseGeocodeMany(
  db: D1Database,
  coords: readonly { lat: number; lon: number }[],
  fetchImpl: Fetch = fetch,
): Promise<Map<string, PlaceInfo | null>> {
  const wanted = new Map<string, { lat: number; lon: number }>()
  for (const c of coords) {
    if (Number.isFinite(c.lat) && Number.isFinite(c.lon)) wanted.set(geocodeKey(c.lat, c.lon), c)
  }
  const found = new Map<string, PlaceInfo | null>()
  const keys = [...wanted.keys()]
  for (let i = 0; i < keys.length; i += KEYS_PER_SELECT) {
    const chunk = keys.slice(i, i + KEYS_PER_SELECT)
    const { results } = await db
      .prepare(`SELECT key, data FROM geocodes WHERE key IN (${chunk.map(() => '?').join(',')})`)
      .bind(...chunk)
      .all<{ key: string; data: string }>()
    for (const r of results) found.set(r.key, JSON.parse(r.data) as PlaceInfo | null)
  }
  const missing = keys.filter((k) => !found.has(k))
  const fetched: { key: string; lat: number; lon: number; place: PlaceInfo | null }[] = []
  await runLimited(CONCURRENCY, missing, async (key) => {
    const { lat, lon } = wanted.get(key) as { lat: number; lon: number }
    const place = await fetchPlace(lat, lon, fetchImpl)
    if (place === undefined) return
    found.set(key, place)
    fetched.push({ key, lat, lon, place })
  })
  if (fetched.length > 0) {
    const now = Date.now()
    const insert = db.prepare(
      'INSERT OR REPLACE INTO geocodes (key, lat, lon, data, fetched_at) VALUES (?, ?, ?, ?, ?)',
    )
    await db.batch(
      fetched.map((f) =>
        insert.bind(
          f.key,
          Number(f.lat.toFixed(3)),
          Number(f.lon.toFixed(3)),
          JSON.stringify(f.place),
          now,
        ),
      ),
    )
  }
  return found
}

/** Undefined on a network or server error, so the miss is not cached. */
async function fetchPlace(
  lat: number,
  lon: number,
  fetchImpl: Fetch,
): Promise<PlaceInfo | null | undefined> {
  const url = `${PHOTON_REVERSE_URL}?lat=${lat.toFixed(3)}&lon=${lon.toFixed(3)}&limit=1&lang=en`
  try {
    const res = await fetchImpl(url, {
      headers: { 'User-Agent': 'rivian-mcp (https://github.com/zentered-studios/rivian-mcp)' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) return undefined
    return parsePhotonReverse(await res.json())
  } catch {
    return undefined
  }
}

async function runLimited<T>(
  limit: number,
  items: readonly T[],
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const item = items[next++]
      await fn(item)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
}
