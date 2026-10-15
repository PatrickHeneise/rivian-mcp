# Tool-call examples

Call these MCP tools through your connected AI app. The JSON blocks contain tool arguments. Replace `YOUR_DRIVE_ID` with an ID from `list_drives`.

## Live vehicle data (local and Cloudflare)

`rivian_get_vehicle_state` queries the first vehicle on the account. It has no vehicle-selector argument:

```json
{}
```

`rivian_get_vehicle_state` for selected properties:

```json
{ "properties": ["batteryLevel", "vehicleMileage"] }
```

Local sign-in uses `rivian_login` followed by `rivian_submit_otp`. The Cloudflare version signs in through the connector's browser flow instead; it does not expose login tools.

## Recorder views (Cloudflare only)

`show_status` takes no arguments. It reads live vehicle state and shows a dashboard: a drawing of the R1S, R1T or R2 with doors, closures, windows and tires, lock state, battery, range, charging, cabin, location, software update status and anything that needs attention:

```json
{}
```

`show_drive` with no arguments shows the latest recorded drive, including an in-progress drive:

```json
{}
```

`show_stats` accepts 1–365 days; `show_charging` accepts 1–90 days:

```json
{ "days": 30 }
```

Charging views infer sessions from rising state of charge. Energy is estimated from state of charge and pack capacity, not charger billing data. Live charging history is a separate Rivian query.

`list_drives` for a UTC date range:

```json
{ "since": "2026-10-01", "until": "2026-10-14", "limit": 20 }
```

Both dates are inclusive and filter the drive's start. The default minimum distance is 0.2 km; use `min_distance_km: 0` to inspect shorter recordings. Results are newest first, with at most 100 per call. Narrow the date range to find older drives.

## Export a completed drive

`export_drive` defaults to the latest completed drive that is not GPS noise:

```json
{}
```

Request a particular drive as GPX:

```json
{ "id": "YOUR_DRIVE_ID", "format": "gpx", "max_points": 500 }
```

Export a date range as GeoJSON:

```json
{ "since": "2026-10-01", "until": "2026-10-14", "format": "geojson", "max_points": 200 }
```

Choose `id` or dates. If you supply both, `id` takes precedence. `max_points` accepts 2–2000 points per drive and defaults to 100.

Date ranges exclude unfinished drives and GPS noise by default. Use `include_noise: true` to include noise. Each range stops at 50 completed drives. A separate text block reports that limit, leaving the first content block as valid JSON or GPX. Narrow the dates to retrieve the rest.

For a compatible Roadbook connector, leave `format` at `roadbook`. Pass a single object as its `drive` argument, or the batch's `drives` array as its `drives` argument. The import is a separate call to Roadbook. See [the payload contract](roadbook.md).
