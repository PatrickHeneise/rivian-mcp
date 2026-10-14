# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Critical Safety Rule

**This project is READ ONLY against the Rivian API.** Never add GraphQL mutations that write, update, or send commands. The only allowed mutations are `CreateCSRFToken`, `Login`, and `LoginWithOTP` (authentication). No `sendVehicleCommand`, `setVehicleName`, `setChargingSchedules`, or any other write operation.

## Commands

```sh
npm run typecheck && npm run lint && npm test   # full local gate
node --test test/format.test.ts                 # one test file
npm run format                                  # biome check --write
npm run build                                   # bundle src/ into dist/ (prepack runs it)
npm start                                       # run the MCP server from source
npm run worker:dev                              # wrangler dev; needs .dev.vars (copy .dev.vars.example)
npm run worker:types                            # regenerate worker/worker-configuration.d.ts after wrangler.jsonc changes
npx wrangler deploy --dry-run                   # build the Worker without deploying
```

Source and tests are TypeScript, run directly by Node's type stripping. Node does not strip types inside `node_modules`, so the published package ships the esbuild bundle in `dist/`.

## Architecture

- **`src/mcp-server.ts`** — MCP server entry point (`@modelcontextprotocol/server` v2, `serveStdio`). Registers tools and formats responses for human readability. Every tool except `rivian_login` and `rivian_submit_otp` is `readOnlyHint: true`. A TTY on stdin runs the CLI instead.
- **`src/cli.ts`** — CLI entry point. Provides `ota` and `stats` commands for direct terminal use.
- **`src/tools.ts`** — The seven live query tools, registered by both the stdio server and the Worker. `QueryContext` says where the session and vehicle come from.
- **`src/rivian-api.ts`** — All Rivian API interaction. Plain ESM functions; each takes the `Session` as its first argument. Wraps Rivian's undocumented GraphQL API (schema referenced from `bretterer/rivian-python-client`).
- **`src/ui.ts`** — Terminal UI primitives: chalk colors (amber on forest green, not Rivian's brand colors), progress bars, vehicle/tire diagrams, tables, section headers.
- **`src/session.ts`** — Session persistence to `~/.rivian-mcp/session.json`. Handles load, save, and expiry.
- **`src/format.ts`** — Formatting helpers for human-readable MCP/CLI output.
- **`.claude/skills/SKILL.md`** — Detailed API reference: endpoints, GraphQL schema, function signatures, all confirmed vehicle state properties, OTA status values. Consult this when adding queries or working with vehicle data.

## Auth Flow

Two-step MFA authentication. Session state persists to `~/.rivian-mcp/session.json`:

1. `createCsrfToken(session)` → `login(session, email, password)` → returns `{ mfa: true }` → OTP sent to user
2. `validateOtp(session, email, code)` → saves full session tokens
3. Subsequent launches restore session automatically (expires after 90 days)

Key headers: `Csrf-Token`, `A-Sess` (appSessionToken), `U-Sess` (userSessionToken).

## Environment

`RIVIAN_EMAIL` and `RIVIAN_PASSWORD` are passed as env vars in the MCP server config.

## Style

- Pure ESM (`"type": "module"`), TypeScript with explicit `.ts` import extensions (`allowImportingTsExtensions`, `erasableSyntaxOnly`). No enums, namespaces or parameter properties
- Biome: single quotes, no semicolons, 2 spaces, width 100
- Plain functions, no classes
- GraphQL queries are inline template literals
- MCP tool responses are formatted as readable text, not raw JSON
- **Conventional commits required** — `feat:`, `fix:`, `chore:`, etc. Semantic-release uses these to determine version bumps and generate changelogs

## API Units & Values

- The API returns raw values with **no unit metadata**. `currentUser.settings.distanceUnit/temperatureUnit/pressureUnit` exist but may be `null`.
- `vehicleMileage` is in **meters** regardless of user setting (live: `47393698` = 47,394 km) — divide by 1000 for km. `distanceToEmpty` follows the user's in-vehicle distance setting.
- Battery level has float noise (e.g. `48.600002`) — round for display. OTA `0.0.0` version / empty hash / zero progress = no update, hide in output.
- `cabinPreconditioningStatus` returns the string `"undefined"` when off — filter it.

## Testing New Vehicle State Properties

Probe unknown fields one at a time via `getVehicleState(vehicleId, new Set(['fieldName']))`. The API returns `GRAPHQL_VALIDATION_FAILED` for non-existent fields and `null` for fields that exist but have no data. See `references/vehicle-state-properties.md` for the full confirmed/rejected list.
External API docs: `../rivian-api/app/` (local clone of `kaedenbrinkman/rivian-api`).

## Adding New API Queries

1. Consult `.claude/skills/SKILL.md` for confirmed-working fields and what has already been tested
2. Add an exported function to `src/rivian-api.ts`
3. Gateway queries use `authHeaders()`, charging queries use `chargingHeaders()`
4. Use `vehicleState(id: $vehicleID)` for vehicle state — variable is `vehicleID`, not `vehicleId`
5. Add formatting to `src/format.ts` and an MCP tool in `src/mcp-server.ts`

## Cloudflare Worker (`worker/`)

Optional self-hosted recorder. This repo deploys nothing: users deploy their own copy with the Deploy to Cloudflare button or `npm run deploy` (guide: `docs/cloudflare.md`). `wrangler.jsonc` sits at the repo root, because the Deploy button needs the Worker and its dependencies at the root. It has no account or resource ids; Wrangler creates D1 and KV on first deploy. Keep it that way. Worker packages are `devDependencies`, so npm users do not install them.

- `worker/src/index.ts` wraps `/mcp` in `@cloudflare/workers-oauth-provider`. One provider per request origin, since the OAuth resource URL is the Worker's own address. OAuth state lives in KV `OAUTH_KV`.
- `worker/src/oauth.ts` serves `/authorize`: Rivian email and password, then the one-time code. It refuses any email but the `RIVIAN_EMAIL` secret, the only secret. Both steps count against `LOGIN_LIMITER`. `logins.ts` keeps each sign-in in its own `pending:<id>` entry (`pending.ts`: 10 minute TTL, at most 5) and replaces the recording session only after Rivian accepts the code. There is no password secret and no login tool: when Rivian ends the session, the user reconnects the connector.
- `worker/src/recorder.ts`: one `Recorder` Durable Object holds the Rivian websocket (`graphql-transport-ws`) with `parallaxMessages` and `vehicleState` subscriptions per vehicle, and records drives (`drive.ts`, pure) and charging samples to D1. `rivianSession()` hands the stored session to the shared query tools. Close code 4420 reconnects after 2 s, 4401/4403 clear the session, other errors back off from 10 s to 15 min. A 60 s alarm is the watchdog.
- `worker/src/parallax.ts` decodes base64 protobuf with a hand-written wire reader. Field numbers from bretterer/rivian-python-client.
- `worker/src/mcp.ts` registers the shared query tools plus `recorder_status`, `list_drives` and `get_drive`. `apps.ts` registers the MCP Apps `show_drive`, `show_stats` and `show_charging`, rendered by the view in `worker/ui/` (bundled to `worker/dist/app.html` by `npm run worker:build`).
- D1 schema: `worker/migrations/`. Timestamps are Unix epoch ms. Add new migrations as new files; never edit an applied one.
- Worker code imports the core with relative paths (`../../src/rivian-api.ts`, `../../src/tools.ts`). Only pure modules have tests (`worker/test/`). `recorder.ts`, `mcp.ts` and `index.ts` depend on Worker bindings.
- The sign-in cookies are `__Host-` and `Secure`. Browsers send them to `localhost`; most HTTP clients do not.
- Palette: amber on forest green, defined in `worker/ui/app.css`, `STYLE` in `worker/src/oauth.ts` and `src/ui.ts`. Change them together. No Rivian logo, wordmark or brand colors. Every page says it is unofficial.

