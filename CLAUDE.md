# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Critical Safety Rule

**This project is READ ONLY against the Rivian API.** Never add GraphQL mutations that write, update, or send commands. The only allowed mutations are `CreateCSRFToken`, `Login`, and `LoginWithOTP` (authentication). No `sendVehicleCommand`, `setVehicleName`, `setChargingSchedules`, or any other write operation.

## Architecture

- **`mcp-server.js`** — MCP server entry point. Registers tools and formats responses for human readability.
- **`cli.js`** — CLI entry point. Provides `ota` and `stats` commands for direct terminal use.
- **`lib/rivian-api.js`** — All Rivian API interaction. Plain ESM functions with module-level session state. Wraps Rivian's undocumented GraphQL API (schema referenced from `bretterer/rivian-python-client`).
- **`lib/ui.js`** — Terminal UI primitives: chalk colors (Rivian green brand), progress bars, vehicle/tire diagrams, tables, section headers.
- **`lib/session.js`** — Session persistence to `~/.rivian-mcp/session.json`. Handles load, save, and expiry.
- **`lib/format.js`** — Formatting helpers for human-readable MCP/CLI output.
- **`.claude/skills/SKILL.md`** — Detailed API reference: endpoints, GraphQL schema, function signatures, all confirmed vehicle state properties, OTA status values. Consult this when adding queries or working with vehicle data.

## Auth Flow

Two-step MFA authentication. Session state persists to `~/.rivian-mcp/session.json`:

1. `createCsrfToken()` → `login(email, password)` → returns `{ mfa: true }` → OTP sent to user
2. `validateOtp(email, code)` → saves full session tokens
3. Subsequent launches restore session automatically (expires after 7 days)

Key headers: `Csrf-Token`, `A-Sess` (appSessionToken), `U-Sess` (userSessionToken).

## Environment

`RIVIAN_EMAIL` and `RIVIAN_PASSWORD` are passed as env vars in the MCP server config.

## Style

- Pure ESM (`"type": "module"`)
- Plain functions, no classes
- GraphQL queries are inline template literals
- MCP tool responses are formatted as readable text, not raw JSON
- **Conventional commits required** — `feat:`, `fix:`, `chore:`, etc. Semantic-release uses these to determine version bumps and generate changelogs

## API Units & Values

- The API returns raw values with **no unit metadata**. `currentUser.settings.distanceUnit/temperatureUnit/pressureUnit` exist but may be `null`.
- `vehicleMileage` is always in km regardless of user setting. `distanceToEmpty` follows the user's in-vehicle distance setting.
- Battery level has float noise (e.g. `48.600002`) — round for display. OTA `0.0.0` version / empty hash / zero progress = no update, hide in output.
- `cabinPreconditioningStatus` returns the string `"undefined"` when off — filter it.

## Testing New Vehicle State Properties

Probe unknown fields one at a time via `getVehicleState(vehicleId, new Set(['fieldName']))`. The API returns `GRAPHQL_VALIDATION_FAILED` for non-existent fields and `null` for fields that exist but have no data. See `references/vehicle-state-properties.md` for the full confirmed/rejected list.
External API docs: `../rivian-api/app/` (local clone of `kaedenbrinkman/rivian-api`).

## Adding New API Queries

1. Consult `.claude/skills/SKILL.md` for confirmed-working fields and what has already been tested
2. Add an exported function to `lib/rivian-api.js`
3. Gateway queries use `authHeaders()`, charging queries use `chargingHeaders()`
4. Use `vehicleState(id: $vehicleID)` for vehicle state — variable is `vehicleID`, not `vehicleId`
5. Add formatting to `lib/format.js` and an MCP tool in `mcp-server.js`
