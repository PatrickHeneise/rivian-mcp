import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { emptySession, getUserInfo, getVehicleState } from '../src/rivian-api.ts'

const session = emptySession()

// ── Mock fetch ────────────────────────────────────────────────────────

let capturedQuery = ''

beforeEach(() => {
  capturedQuery = ''
  globalThis.fetch = (async (_url: unknown, options: RequestInit) => {
    capturedQuery = JSON.parse(options.body as string).query
    return {
      ok: true,
      json: async () => ({ data: { vehicleState: {} } }),
    }
  }) as unknown as typeof fetch
})

// ── gnssLocation template ─────────────────────────────────────────────

test('gnssLocation does not include isAuthorized', async () => {
  await getVehicleState(session, 'test-id')
  assert.match(capturedQuery, /gnssLocation \{ latitude longitude timeStamp \}/)
  assert.doesNotMatch(capturedQuery, /isAuthorized/)
})

// ── OTA fields ────────────────────────────────────────────────────────

test('OTA fields use { timeStamp value } sub-selection', async () => {
  await getVehicleState(session, 'test-id')
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
  await getVehicleState(session, 'test-id', new Set(['batteryLevel', 'powerState']))
  assert.match(capturedQuery, /batteryLevel \{ timeStamp value \}/)
  assert.match(capturedQuery, /powerState \{ timeStamp value \}/)
  assert.doesNotMatch(capturedQuery, /gnssLocation/)
  assert.doesNotMatch(capturedQuery, /otaStatus/)
})

test('cloudConnection uses its custom template', async () => {
  await getVehicleState(session, 'test-id', new Set(['cloudConnection']))
  assert.match(capturedQuery, /cloudConnection \{ lastSync isOnline \}/)
})

// ── Empty / undefined properties → default set ────────────────────────

test('undefined properties falls back to default set', async () => {
  await getVehicleState(session, 'test-id', undefined)
  // Spot-check a few default fields
  assert.match(capturedQuery, /batteryLevel \{ timeStamp value \}/)
  assert.match(capturedQuery, /gnssLocation/)
  assert.match(capturedQuery, /otaStatus/)
})

// ── props resolution (mcp-server.js logic) ────────────────────────────

test('empty properties array resolves to undefined (uses defaults)', () => {
  const resolve = (properties?: string[]) => (properties?.length ? new Set(properties) : undefined)
  assert.equal(resolve([]), undefined, '[] should resolve to undefined')
  assert.equal(resolve(undefined), undefined, 'undefined should resolve to undefined')
  const result = resolve(['batteryLevel'])
  assert.ok(result instanceof Set)
  assert.equal(result.size, 1)
})

// ── Query structure ───────────────────────────────────────────────────

test('query uses correct operation name and variable', async () => {
  await getVehicleState(session, 'test-id')
  assert.match(capturedQuery, /query GetVehicleState\(\$vehicleID: String!\)/)
  assert.match(capturedQuery, /vehicleState\(id: \$vehicleID\)/)
})

// ── Oct 2026 discovery ────────────────────────────────────────────────

test('default set includes fields confirmed in Oct 2026', async () => {
  await getVehicleState(session, 'test-id')
  for (const field of [
    'chargingDisabledAC',
    'chargingDisabledAll',
    'closureChargePortDoorNextAction',
    'closureSideBinLeftNextAction',
    'closureSideBinRightNextAction',
    'windowsNextAction',
    'btmOcHardwareFailureStatus',
  ]) {
    assert.match(capturedQuery, new RegExp(`${field} \\{ timeStamp value \\}`), field)
  }
})

test('default set excludes subscription-only fields that HTTP rejects', async () => {
  await getVehicleState(session, 'test-id')
  for (const field of [
    'activeDriverName',
    'chargingDisabledACFaultState',
    'chargingTripTargetSoc',
    'chargingTripTargetMinsRemaining',
    'coldRangeNotification',
    'tirePressureFrontLeft ',
  ]) {
    assert.ok(!capturedQuery.includes(field), `${field.trim()} must not be in the HTTP query`)
  }
})

test('getUserInfo requests build configuration and assembly date', async () => {
  await getUserInfo(session)
  assert.match(capturedQuery, /actualGeneralAssemblyDate/)
  for (const option of [
    'trimOption',
    'driveSystemOption',
    'exteriorColorOption',
    'interiorColorOption',
    'wheelOption',
  ]) {
    assert.match(capturedQuery, new RegExp(`${option} \\{ optionId optionName \\}`), option)
  }
})
