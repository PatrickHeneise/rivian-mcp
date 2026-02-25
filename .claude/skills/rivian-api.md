---
name: rivian-api
description: Rivian API reference for building features against the unofficial Rivian GraphQL API. Apply when working with vehicle data, authentication, or any Rivian API interaction.
---

# Rivian API Skill

## CRITICAL SAFETY RULE
**This project is READ ONLY. Never add mutations that write, update, or send commands to the API.** The only mutations allowed are `CreateCSRFToken`, `Login`, and `LoginWithOTP` (authentication). No `sendVehicleCommand`, `setVehicleName`, `setChargingSchedules`, or any other write operation.

## Architecture

- **`lib/rivian.js`** — Plain ESM functions with module-level session state. All API interaction goes through here.
- **`mcp-server.js`** — MCP server entry point. Session persistence, tool registration, response formatting.

## Authentication Flow

1. `createCsrfToken()` → gets `csrfToken` + `appSessionToken`
2. `login(email, password)` → returns `{ mfa: true|false }`
   - If `mfa: false`: tokens are set, ready to query
   - If `mfa: true`: call `validateOtp(email, code)` with the OTP from SMS/email
3. Subsequent queries use `A-Sess` (appSessionToken) and `U-Sess` (userSessionToken) headers
4. `exportSession()` / `restoreSession(session)` — serialize/restore module state
5. `isAuthenticated()` / `needsOtp()` — check auth status

## API Endpoints

| Endpoint | Purpose | Headers |
|---|---|---|
| `https://rivian.com/api/gql/gateway/graphql` | Main gateway — auth, vehicle info, state | `authHeaders()` |
| `https://rivian.com/api/gql/chrg/user/graphql` | Charging data | `chargingHeaders()` |
| `https://rivian.com/api/gql/orders/graphql` | Orders (not implemented, read-only queries only) | — |
| `https://rivian.com/api/gql/t2d/graphql` | Payments (not implemented, read-only queries only) | — |

## Implemented Read-Only Functions

### `getUserInfo()`
Returns current user with all vehicles. Key fields:
- `vehicle.otaEarlyAccessStatus` (Boolean) — OTA software update eligibility
- `vehicle.currentOTAUpdateDetails` / `availableOTAUpdateDetails` — version info + release notes URL
- `vehicle.vehicleState.supportedFeatures` — list of available features

### `getVehicleState(vehicleId, properties?)`
Returns live vehicle state. Pass a `Set` of property names. Uses vehicle ID (e.g., `01-246161849`), not VIN.
Key OTA properties: `otaStatus`, `otaAvailableVersion`, `otaCurrentVersion`, `otaInstallReady`, `otaInstallProgress`, `otaDownloadProgress`, `otaCurrentStatus`, `otaInstallType`.
Other useful: `batteryLevel`, `distanceToEmpty`, `vehicleMileage`, `powerState`, `chargerStatus`, `gnssLocation`, `doorXxxClosed/Locked`, `closureXxxClosed/Locked`.

Property values come as `{ timeStamp, value }` except:
- `cloudConnection` → `{ lastSync, isOnline }`
- `gnssLocation` → `{ latitude, longitude, timeStamp, isAuthorized }`
- `gnssError` → `{ timeStamp, positionVertical, positionHorizontal, speed, bearing }`

### `getOTAUpdateDetails(vehicleId)`
Returns `currentOTAUpdateDetails` and `availableOTAUpdateDetails` with `{ url, version, locale }`. Uses vehicle ID (not VIN).

### `getLiveChargingSession(vehicleId)`
Returns live charging data: power, SOC, time remaining, energy charged, charger state. Uses vehicle ID.

### `getDriversAndKeys(vehicleId)`
Returns invited users (provisioned and unprovisioned) and their enrolled devices/keys.

## GraphQL Schema Reference (Gateway)

### Key Types

```graphql
type Vehicle {
  id: String!
  vin: String!
  make: String!
  model: String!
  modelYear: Int!
  otaEarlyAccessStatus: Boolean!
  currentOTAUpdateDetails: OTAUpdateDetails!
  availableOTAUpdateDetails: OTAUpdateDetails  # null = no update available
  vehicleState: VehicleState!
}

type OTAUpdateDetails {
  url: String!
  version: String!
  locale: String!
}
```

### OTA Status Values
- `Idle` — no update activity
- `Available` — update available
- `Ready_To_Install` / `Scheduled_To_Install` — ready for install
- `Install_Countdown` / `Awaiting_Install` / `Installing` — in progress
- `Success` / `Failed` — completed

### Vehicle State OTA Properties
All `TimeStampedString` or `TimeStampedInt` with `{ timeStamp, value }`:
- `otaCurrentVersion` / `otaAvailableVersion` — version strings (e.g., "2025.3.0")
- `otaCurrentVersionGitHash` / `otaAvailableVersionGitHash`
- `otaCurrentVersionYear` / `otaCurrentVersionWeek` / `otaCurrentVersionNumber`
- `otaAvailableVersionYear` / `otaAvailableVersionWeek` / `otaAvailableVersionNumber`
- `otaStatus` — current OTA state
- `otaInstallReady` — is install ready
- `otaInstallProgress` — install progress (0-100)
- `otaDownloadProgress` — download progress (0-100)
- `otaInstallDuration` / `otaInstallTime` / `otaInstallType`

### `getChargingHistory()`
Returns all completed charging sessions. No parameters needed — returns all sessions for the authenticated user.
Key fields: `startInstant`, `endInstant`, `totalEnergyKwh`, `rangeAddedKm`, `paidTotal`, `currencyCode`, `city`, `vendor`, `chargerType`, `isHomeCharger`, `isRoamingNetwork`, `isPublic`.

### `getChargingSchedule(vehicleId)`
Returns configured charging schedules. Key fields:
- `startTime` — minutes from midnight (e.g., 1320 = 10:00 PM)
- `duration` — minutes (e.g., 360 = 6 hours)
- `amperage`, `enabled`, `weekDays`, `location { latitude, longitude }`

## Known Read-Only Queries (Not Yet Implemented)

These queries exist in the Rivian API and could be added as read-only functions:

### Gateway (`gateway/graphql`)
- `getVehicleOrderStatus(vehicleId)` — order/delivery status
- `getVehicleWarranty(vehicleId)` — warranty details
- `getVehicleLastConnection(vehicleId)` — last cloud connection time
- `planTrip(...)` — route planning with charging stops
- `getNearbyChargingSites(...)` — nearby chargers with availability
- `getVehicleImages(vehicleId)` — vehicle renders/photos

### Charging (`chrg/user/graphql`)
- `getChargingSiteDetails(siteId)` — charger details, pricing, availability

### Orders (`orders/graphql`)
- `getOrderDetails(orderId)` — order configuration, status, delivery timeline

**DO NOT IMPLEMENT**: `sendVehicleCommand`, `setVehicleName`, `setChargingSchedules`, `updateVehicleSettings`, `enrollPhone`, or any other mutation that modifies vehicle/account state.

## Adding New Queries

1. Find the query in the GraphQL schema (see `bretterer/rivian-python-client` repo `src/rivian/schemas/gateway.graphql`)
2. Add an exported function to `lib/rivian.js`
3. Gateway queries use `authHeaders()`, charging queries use `chargingHeaders()`
4. Add a corresponding MCP tool in `mcp-server.js` with a user-friendly description and formatted response
5. **Never add mutations** except auth-related ones
