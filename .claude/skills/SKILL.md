---
name: rivian-api
description: This skill should be used when working with the Rivian GraphQL API — adding new queries, updating vehicle state properties, implementing MCP tools, debugging API errors, or asking about available vehicle data fields. Apply when touching lib/rivian-api.js, lib/format.js, mcp-server.js, or any Rivian API interaction.
---

# Rivian API Skill

## Critical Safety Rule

**This project is READ ONLY. Never add mutations that write, update, or send commands.**

Allowed mutations: `CreateCSRFToken`, `Login`, `LoginWithOTP` only.
Forbidden: `sendVehicleCommand`, `setVehicleName`, `setChargingSchedules`, any write operation.

## Architecture

| File                | Purpose                                             |
| ------------------- | --------------------------------------------------- |
| `lib/rivian-api.js` | All API interaction — session state, queries, auth  |
| `lib/format.js`     | Human-readable output for MCP/CLI                   |
| `lib/session.js`    | Session persistence to `~/.rivian-mcp/session.json` |
| `mcp-server.js`     | MCP server — tool registration and session restore  |
| `cli.js`            | CLI — `ota` and `stats` commands                    |

## API Endpoints

| Endpoint                                       | Purpose                                       | Auth                                                      |
| ---------------------------------------------- | --------------------------------------------- | --------------------------------------------------------- |
| `https://rivian.com/api/gql/gateway/graphql`   | Auth, vehicle info, state, schedules, drivers | `authHeaders()` → `{ A-Sess, U-Sess }`                    |
| `https://rivian.com/api/gql/chrg/user/graphql` | Charging history, live session                | `chargingHeaders()` → `{ U-Sess, Authorization: Bearer }` |

> Introspection is blocked on both endpoints. `/orders/graphql` and `/t2d/graphql` exist but are untested.

## Authentication Flow

1. `createCsrfToken()` → gets `csrfToken` + `appSessionToken`
2. `login(email, password)` → `{ mfa: true|false }`
   - `mfa: true` → OTP sent → `validateOtp(email, code)`
3. All queries require `A-Sess` + `U-Sess` headers
4. Session persists to `~/.rivian-mcp/session.json`, valid 7 days
5. `exportSession()` / `restoreSession(saved)` — serialize/restore state
6. `isAuthenticated()` / `needsOtp()` — check status

## Implemented Functions

### `getUserInfo()`

Returns `currentUser` with vehicles. Extracts `vehicles[0].id` — the vehicle ID used in all subsequent queries (e.g. `01-246161849`). Not the VIN.

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

### `getOTAUpdateDetails(vehicleId)`

Returns `currentOTAUpdateDetails`, `availableOTAUpdateDetails`, and `vehicleState.otaStatus` via `getVehicle(id:)`.

### `getLiveChargingSession(vehicleId)`

Returns live charge data or `null` when not charging. Uses charging endpoint.

### `getChargingHistory()`

Returns all completed sessions for the authenticated user. No parameters.

### `getChargingSchedule(vehicleId)`

Returns `chargingSchedules` array from `getVehicle`.

### `getDriversAndKeys(vehicleId)`

Returns `invitedUsers` (provisioned + unprovisioned) with enrolled devices.

## Adding a New Vehicle State Property

1. Verify the field name exists — check `references/vehicle-state-properties.md` first. The API silently rejects unknown fields with `GRAPHQL_VALIDATION_FAILED`.
2. Add to `DEFAULT_VEHICLE_STATE_PROPERTIES` in `lib/rivian-api.js`.
3. If the field needs a non-standard fragment (not `{ timeStamp value }`), add it to `TEMPLATE_MAP`.
4. Add formatting in `lib/format.js` — either in an existing section or a new one. Mark fields as `printed` to prevent them falling into the "Other" catch-all.

## Adding a New MCP Tool

1. Add an exported function to `lib/rivian-api.js`.
2. Add a `format*` function to `lib/format.js`.
3. Register with `server.tool(name, description, schema, handler)` in `mcp-server.js`.
4. Handler pattern:

```js
;async ({ param }) => {
  try {
    requireAuth()
    const vehicleId = await resolveVehicleId()
    return text(format.formatMyThing(await rivian.getMyThing(vehicleId)))
  } catch (err) {
    return text(err.message)
  }
}
```

## format.js Patterns

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
