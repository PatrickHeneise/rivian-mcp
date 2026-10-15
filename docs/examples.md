# Tool-call examples

These are MCP tool arguments, not HTTP request bodies. Use the tools through your connected AI app. Example ids are placeholders; replace them with an id returned by `list_drives`.

## Live vehicle data (local and Cloudflare)

`rivian_get_vehicle_state` uses the first vehicle on the account (there is no vehicle-selector argument):

```json
{}
```

`rivian_get_vehicle_state` for selected properties:

```json
{ "properties": ["batteryLevel", "vehicleMileage"] }
```

Local sign-in uses `rivian_login` followed by `rivian_submit_otp`. The Cloudflare version signs in through the connector's browser flow instead; it does not expose login tools.

## Recorder views (Cloudflare only)

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

Both dates are inclusive and filter the drive's start. The default minimum distance is 0.2 km; use `min_distance_km: 0` to inspect shorter recordings. Listing is newest first and capped at 100 per call; narrow the date range when necessary.

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

Choose either `id` or dates; if both are supplied, `id` takes precedence. `max_points` is 2–2000, default 100, per drive. Ranges exclude unfinished drives and GPS noise by default and stop at 50 completed drives. A separate text block reports truncation, so the first content block remains valid JSON or GPX. Narrow the dates to retrieve the rest. Use `include_noise: true` only when you want those recordings too.

For Roadbook, leave `format` at `roadbook`. Pass the returned single object as Roadbook's `drive` argument, or the batch's `drives` array as its `drives` argument. Rivian MCP only exports; creating the trip is a separate call to Roadbook. See [the payload contract](roadbook.md).
