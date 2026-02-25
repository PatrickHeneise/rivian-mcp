# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Critical Safety Rule

**This project is READ ONLY against the Rivian API.** Never add GraphQL mutations that write, update, or send commands. The only allowed mutations are `CreateCSRFToken`, `Login`, and `LoginWithOTP` (authentication). No `sendVehicleCommand`, `setVehicleName`, `setChargingSchedules`, or any other write operation.

## Architecture

This is a pure MCP server — no CLI.

- **`mcp-server.js`** — MCP server entry point. Registers tools, handles session persistence (`~/.rivian-mcp/session.json`), and formats responses for human readability.
- **`lib/rivian.js`** — All Rivian API interaction. Plain ESM functions with module-level session state. Wraps Rivian's undocumented GraphQL API (schema referenced from `bretterer/rivian-python-client`).
- **`.claude/skills/rivian-api.md`** — Detailed API reference: endpoints, GraphQL schema, function signatures, OTA status values. Consult this when adding queries or working with vehicle data.

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

## Adding New API Queries

1. Reference the GraphQL schema in `bretterer/rivian-python-client` repo (`src/rivian/schemas/gateway.graphql`)
2. Add an exported function to `lib/rivian.js`
3. Gateway queries use `authHeaders()`, charging queries use `chargingHeaders()`
4. `getVehicleState()` takes vehicle ID (e.g., `01-246161849`), not VIN
5. Add a corresponding MCP tool in `mcp-server.js` with a user-friendly description and formatted response
