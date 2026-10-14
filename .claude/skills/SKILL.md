---
name: rivian-api
description: This skill should be used when working with the Rivian GraphQL API — adding new queries, updating vehicle state properties, implementing MCP tools, debugging API errors, or asking about available vehicle data fields. Apply when touching src/rivian-api.ts, src/format.ts, src/mcp-server.ts, or any Rivian API interaction.
---

# Rivian API Skill

## Critical Safety Rule

**This project is READ ONLY. Never add mutations that write, update, or send commands.**

Allowed mutations: `CreateCSRFToken`, `Login`, `LoginWithOTP` only.
Forbidden: `sendVehicleCommand`, `setVehicleName`, `setChargingSchedules`, any write operation.

## Architecture

| File                | Purpose                                             |
| ------------------- | --------------------------------------------------- |
| `src/rivian-api.ts` | All API interaction — session state, queries, auth  |
| `src/format.ts`     | Human-readable output for MCP/CLI                   |
| `src/session.ts`    | Session persistence to `~/.rivian-mcp/session.json` |
| `src/mcp-server.ts`     | MCP server — tool registration and session restore  |
| `src/cli.ts`            | CLI — `ota` and `stats` commands                    |

## API Endpoints

| Endpoint                                       | Purpose                                       | Auth                                                      |
| ---------------------------------------------- | --------------------------------------------- | --------------------------------------------------------- |
| `https://rivian.com/api/gql/gateway/graphql`   | Auth, vehicle info, state, schedules, drivers | `authHeaders()` → `{ A-Sess, U-Sess }`                    |
| `https://rivian.com/api/gql/chrg/user/graphql` | Charging history, live session                | `chargingHeaders()` → `{ U-Sess, Authorization: Bearer }` |

> Introspection is blocked on both endpoints. `/orders/graphql` and `/t2d/graphql` exist but are untested.
>
> **Discovery tip:** the charging endpoint returns Apollo `Did you mean "..."?` suggestions and full validation messages (unknown field, missing required argument with its type). Probe it with near-complete names to enumerate fields and arguments. The gateway masks every validation error as `Error in GraphQL validation`, so probe it one field per request.

## Authentication Flow

1. `createCsrfToken(session)` → gets `csrfToken` + `appSessionToken`
2. `login(session, email, password)` → `{ mfa: true|false }`
   - `mfa: true` → OTP sent → `validateOtp(session, email, code)`
3. All queries require `A-Sess` + `U-Sess` headers
4. Session persists to `~/.rivian-mcp/session.json`, valid 90 days (`SESSION_MAX_AGE_MS` in `src/session.ts`)
5. `exportSession(session)` / `restoreSession(session, saved)` — serialize/restore state
6. `isAuthenticated(session)` / `needsOtp(session)` — check status

## Implemented Functions

### `getUserInfo()`

Returns `currentUser` with vehicles, including `vehicle.mobileConfiguration` (trim, drive system, exterior, interior, wheels) and `vehicle.actualGeneralAssemblyDate`. Extracts `vehicles[0].id` — the vehicle ID used in all subsequent queries (e.g. `01-246161849`). Not the VIN.

### `getVehicleState(vehicleId, properties?)`

**Critical:** Uses `vehicleState(id: $vehicleID)` — variable is `vehicleID` (capital D), not `vehicleId`.

```graphql
query GetVehicleState($vehicleID: String!) {
  vehicleState(id: $vehicleID) {
    batteryLevel {
      timeStamp
      value
    }
    cloudConnection {
      lastSync
      isOnline
    }
    # ...
  }
}
```

Pass a `Set<string>` to fetch specific properties; omit for the full default set (~80 properties). Most return `{ timeStamp, value }`. Three use custom templates defined in `TEMPLATE_MAP`: `cloudConnection`, `gnssLocation`, `gnssError`.

**Units gotcha:** `vehicleMileage` is in **meters** (live `47393698` = 47,394 km) — divide by 1000 for km. `batteryLevel` has float noise (round for display). See `references/vehicle-state-properties.md` for per-field units.

### `getOTAUpdateDetails(vehicleId)`

Returns `currentOTAUpdateDetails`, `availableOTAUpdateDetails`, and `vehicleState.otaStatus` via `getVehicle(id:)`.

### `getLiveChargingSession(vehicleId)`

Queries `getLiveSessionHistory(vehicleId: ID!)` on the charging endpoint. `getLiveSessionData` was removed (rejected Oct 2026) and its fields moved to `getLiveSessionHistory`. The query returns an all-null object when not charging, and also during an active charge it does not track (live, Oct 10, 2026: `chargerState: charging_active`, every field `null`). The function returns `null` in both cases.

### `getChargingState(vehicleId)`

Reads `batteryLevel`, `batteryLimit`, `timeToEndOfCharge`, `chargerState` and `chargingTimeEstimationValidity` from vehicle state. `rivian_get_charging_session` calls it when `getLiveChargingSession` returns `null`, and `formatChargingSession(null, state)` shows the charge when `chargerState` is `charging_active`.

### `getChargingHistory(vehicleId)`

Queries `getCompletedSessionSummariesV2(vehicleId: String!, pageSize: Int, searchAfter: String)` and follows `pageInfo.nextCursor` (max `pageSize` 100, cap 30 pages). Maps each item to the legacy flat shape (`startInstant`, `totalEnergyKwh`, `rangeAddedKm`, `vendor`, `city`, `paidTotal`, ...). The v1 `getCompletedSessionSummaries` still validates but returns `[]` (Oct 2026).

### `getChargingSchedule(vehicleId)`

Returns `chargingSchedules` array from `getVehicle`.

### `getDriversAndKeys(vehicleId)`

Returns `invitedUsers` (provisioned + unprovisioned) with enrolled devices.

## Adding a New Vehicle State Property

1. Verify the field name exists — check `references/vehicle-state-properties.md` first. The API silently rejects unknown fields with `GRAPHQL_VALIDATION_FAILED`.
2. Add to `DEFAULT_VEHICLE_STATE_PROPERTIES` in `src/rivian-api.ts`.
3. If the field needs a non-standard fragment (not `{ timeStamp value }`), add it to `TEMPLATE_MAP`.
4. Add formatting in `src/format.ts` — either in an existing section or a new one. Mark fields as `printed` to prevent them falling into the "Other" catch-all.

## Adding a New MCP Tool

1. Add an exported function to `src/rivian-api.ts`.
2. Add a `format*` function to `src/format.ts`.
3. Register with `server.registerTool(name, { description, inputSchema, annotations: READ_ONLY }, handler)` in `src/mcp-server.ts`. `inputSchema` is a `z.object(...)`.
4. Handler pattern (`query` checks auth and turns errors into text):

```ts
({ param }) =>
  query(async () => {
    const vehicleId = await resolveVehicleId()
    return format.formatMyThing(await rivian.getMyThing(session, vehicleId))
  })
```

## format.ts Patterns

`formatVehicleState` uses a `printed` Set to track which keys have been rendered, falling back to an "Other" section for any remainder. When adding a new section:

```js
// Mark keys so they don't leak into "Other"
printed.add('myNewField')
const val = state.myNewField?.value
if (val !== null && val !== undefined) lines.push(`  My label: ${val}`)
```

For conditional sections, check whether at least one relevant key is present before pushing a section header:

```js
const myKeys = ['field1', 'field2', 'field3']
if (myKeys.some((k) => k in state)) {
  lines.push('Section Header')
  print('Label', 'field1')
  print('Label', 'field2')
  lines.push('')
}
```

## Common Errors

| Error                           | Cause                                     | Fix                                                                                            |
| ------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `GRAPHQL_VALIDATION_FAILED`     | Unknown field name or wrong variable name | Check `references/vehicle-state-properties.md`; ensure variable is `vehicleID` not `vehicleId` |
| `Not logged in`                 | No session / expired session              | Call `rivian_login` → `rivian_submit_otp`                                                      |
| `HTTP 400 Body cannot be empty` | JSON serialization issue in shell         | Use Node.js or proper JSON escaping                                                            |
| Field leaks into "Other"        | Missing `printed.add(key)` in formatter   | Add the key to `printed` in the appropriate section                                            |

## Additional Resources

- **`references/vehicle-state-properties.md`** — Complete tables of all confirmed-working vehicle state properties with types and example values, charging session/history/schedule fields, and a list of field names that were probed and do NOT exist. Consult before adding any new field.
  - Verified read-only queries not yet implemented as tools: `getRegisteredWallboxes`, `getSessionStatusByVehicleId`, `Vehicle.estimatedRange(startSoc)`, and the `chartData` series of `getLiveSessionHistory`. Schemas are in the reference under "Additional Queries → Confirmed working."
  - Websocket subscriptions (`VehicleState` with subscription-only fields, `ParallaxMessages` with 25 RVM topics, `chargingSession`, `vehicleDepartureSchedules`) are verified live but not used in code. See the reference under "Subscriptions (websocket)". Use one `VehicleState` subscription per vehicle: parallel ones hit `SUBSCRIPTION_LIMIT_EXCEEDED`.
