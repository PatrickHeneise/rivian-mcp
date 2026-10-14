import { chmodSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { exportSession, restoreSession, type SavedSession, type Session } from './rivian-api.ts'

export const CONFIG_DIR = join(homedir(), '.rivian-mcp')
export const SESSION_FILE = join(CONFIG_DIR, 'session.json')
const SESSION_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000

export function loadSession(session: Session): boolean | 'needs_otp' {
  if (!existsSync(SESSION_FILE)) return false

  try {
    const st = statSync(SESSION_FILE)
    if (st.mode & 0o077) {
      console.error(
        `[rivian-mcp] WARNING: ${SESSION_FILE} is readable by other users. Run: chmod 600 "${SESSION_FILE}"`,
      )
    }
  } catch (err) {
    const e = err as NodeJS.ErrnoException
    if (e.code !== 'ENOENT') console.error(`[rivian-mcp] Could not stat session file: ${e.message}`)
  }

  let saved: SavedSession
  try {
    saved = JSON.parse(readFileSync(SESSION_FILE, 'utf8'))
  } catch (err) {
    console.error(`[rivian-mcp] Could not read session file: ${(err as Error).message}`)
    return false
  }

  if (saved.savedAt && Date.now() - saved.savedAt > SESSION_MAX_AGE_MS) {
    console.error('[rivian-mcp] Session expired. Please log in again.')
    return false
  }

  if (saved.authenticated || saved.needsOtp) {
    restoreSession(session, saved)
    return saved.authenticated ? true : 'needs_otp'
  }

  return false
}

export function saveSession(session: Session): void {
  mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 })
  chmodSync(CONFIG_DIR, 0o700)
  const saved: SavedSession = { ...exportSession(session), savedAt: Date.now() }
  writeFileSync(SESSION_FILE, JSON.stringify(saved, null, 2), { mode: 0o600 })
  chmodSync(SESSION_FILE, 0o600)
}
