import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { getVehicleState } from '../lib/rivian-api.js'

// ── Mock fetch ────────────────────────────────────────────────────────

let capturedQuery = null

beforeEach(() => {
  capturedQuery = null
  globalThis.fetch = async (_url, options) => {
    capturedQuery = JSON.parse(options.body).query
    return {
      ok: true,
      json: async () => ({ data: { vehicleState: {} } }),
    }
  }
})

// ── gnssLocation template ─────────────────────────────────────────────

test('gnssLocation does not include isAuthorized', async () => {
  await getVehicleState('test-id')
  assert.match(capturedQuery, /gnssLocation \{ latitude longitude timeStamp \}/)
  assert.doesNotMatch(capturedQuery, /isAuthorized/)
})

// ── OTA fields ────────────────────────────────────────────────────────

test('OTA fields use { timeStamp value } sub-selection', async () => {
  await getVehicleState('test-id')
  for (const field of [
    'otaCurrentVersion',
    'otaAvailableVersion',
    'otaStatus',
    'otaInstallReady',
    'otaInstallProgress',
    'otaCurrentStatus',
    'otaDownloadProgress',
    'otaInstallType',
  ]) {
    assert.match(
      capturedQuery,
      new RegExp(`${field} \\{ timeStamp value \\}`),
      `${field} should use { timeStamp value }`,
    )
  }
})

// ── Custom properties ─────────────────────────────────────────────────

test('custom properties generate correct fragment', async () => {
  await getVehicleState('test-id', new Set(['batteryLevel', 'powerState']))
  assert.match(capturedQuery, /batteryLevel \{ timeStamp value \}/)
  assert.match(capturedQuery, /powerState \{ timeStamp value \}/)
  assert.doesNotMatch(capturedQuery, /gnssLocation/)
  assert.doesNotMatch(capturedQuery, /otaStatus/)
})

test('cloudConnection uses its custom template', async () => {
  await getVehicleState('test-id', new Set(['cloudConnection']))
  assert.match(capturedQuery, /cloudConnection \{ lastSync isOnline \}/)
})

// ── Empty / undefined properties → default set ────────────────────────

test('undefined properties falls back to default set', async () => {
  await getVehicleState('test-id', undefined)
  // Spot-check a few default fields
  assert.match(capturedQuery, /batteryLevel \{ timeStamp value \}/)
  assert.match(capturedQuery, /gnssLocation/)
  assert.match(capturedQuery, /otaStatus/)
})

// ── props resolution (mcp-server.js logic) ────────────────────────────

test('empty properties array resolves to undefined (uses defaults)', () => {
  const resolve = (properties) => (properties?.length ? new Set(properties) : undefined)
  assert.equal(resolve([]), undefined, '[] should resolve to undefined')
  assert.equal(resolve(undefined), undefined, 'undefined should resolve to undefined')
  const result = resolve(['batteryLevel'])
  assert.ok(result instanceof Set)
  assert.equal(result.size, 1)
})

// ── Query structure ───────────────────────────────────────────────────

test('query uses correct operation name and variable', async () => {
  await getVehicleState('test-id')
  assert.match(capturedQuery, /query GetVehicleState\(\$vehicleID: String!\)/)
  assert.match(capturedQuery, /vehicleState\(id: \$vehicleID\)/)
})
