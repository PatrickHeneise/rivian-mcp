// D1 on node:sqlite with the schema from worker/migrations, for tests of modules that query D1.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'

export function fakeD1() {
  const sqlite = new DatabaseSync(':memory:')
  const dir = join(import.meta.dirname, '../../migrations')
  for (const f of readdirSync(dir).sort()) sqlite.exec(readFileSync(join(dir, f), 'utf8'))
  const statement = (sql: string, args: SQLInputValue[] = []) => ({
    bind: (...bound: SQLInputValue[]) => statement(sql, bound),
    run: async () => sqlite.prepare(sql).run(...args),
    all: async () => ({ results: sqlite.prepare(sql).all(...args) }),
    first: async () => sqlite.prepare(sql).get(...args) ?? null,
    exec: () => sqlite.prepare(sql).run(...args),
  })
  const db = {
    prepare: (sql: string) => statement(sql),
    batch: async (statements: ReturnType<typeof statement>[]) => {
      sqlite.exec('BEGIN')
      try {
        for (const s of statements) s.exec()
        sqlite.exec('COMMIT')
      } catch (error) {
        sqlite.exec('ROLLBACK')
        throw error
      }
    },
  }
  return { db: db as unknown as D1Database, sqlite }
}

/** Start of the Boulder to Longmont replay drive from the design brief, UTC. */
export const BOULDER_START_MS = Date.UTC(2026, 9, 13, 20, 4, 11)
export const BOULDER = { lat: 40.0539, lon: -105.2845 }
export const LONGMONT = { lat: 40.1495, lon: -105.1645 }

/**
 * A 227-point track from Boulder to Longmont: east along the Diagonal, then north-east, with a
 * little wobble so a straight-line simplifier cannot drop everything. One fix every 9 s.
 */
export function boulderToLongmont(): {
  ts: number
  lat: number
  lon: number
  alt: number | null
}[] {
  const n = 227
  const bend = { lat: 40.075, lon: -105.21 }
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1)
    const [a, b, u] = t < 0.4 ? [BOULDER, bend, t / 0.4] : [bend, LONGMONT, (t - 0.4) / 0.6]
    const wobble = Math.sin(i / 3) * Math.sin(Math.PI * t) * 0.0004
    return {
      ts: BOULDER_START_MS + i * 9_000,
      lat: a.lat + (b.lat - a.lat) * u + wobble,
      lon: a.lon + (b.lon - a.lon) * u,
      alt: 1655 - 150 * t + 20 * Math.sin(i / 10),
    }
  })
}
