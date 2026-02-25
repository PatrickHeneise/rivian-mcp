import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

export const CONFIG_DIR = join(homedir(), '.rivian-mcp')
export const SESSION_FILE = join(CONFIG_DIR, 'session.json')
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

export function loadSession(rivianApi) {
  if (!existsSync(SESSION_FILE)) return false

  try {
    const st = statSync(SESSION_FILE)
    if (st.mode & 0o077) {
      console.error(
        `[rivian-mcp] WARNING: ${SESSION_FILE} is readable by other users. Run: chmod 600 "${SESSION_FILE}"`,
      )
    }
  } catch (err) {
    if (err.code !== 'ENOENT') console.error(`[rivian-mcp] Could not stat session file: ${err.message}`)
  }

  let session
  try {
    session = JSON.parse(readFileSync(SESSION_FILE, 'utf8'))
  } catch (err) {
    console.error(`[rivian-mcp] Could not read session file: ${err.message}`)
    return false
  }

  if (session.savedAt && Date.now() - session.savedAt > SESSION_MAX_AGE_MS) {
    console.error('[rivian-mcp] Session expired. Please log in again.')
    return false
  }

  if (session.authenticated || session.needsOtp) {
    rivianApi.restoreSession(session)
    return session.authenticated ? true : 'needs_otp'
  }

  return false
}

export function saveSession(rivianApi) {
  mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 })
  chmodSync(CONFIG_DIR, 0o700)
  const session = { ...rivianApi.exportSession(), savedAt: Date.now() }
  writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2), { mode: 0o600 })
  chmodSync(SESSION_FILE, 0o600)
}
