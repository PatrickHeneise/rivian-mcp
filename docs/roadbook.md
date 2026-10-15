# Drive payload for Roadbook

`export_drive` returns a JSON document that Roadbook's `import_drive` MCP tool accepts unchanged. One call on each side turns a recorded drive into a private Roadbook trip with a departure stop, a destination stop, the route and the stats. This page is the contract. Roadbook keeps the same text at `docs/specs/import-drive.md`.

## Flow

1. `list_drives` (optional) to find the drive. Each line carries the place labels and local times, so no second lookup is needed to pick one.
2. `export_drive` with the drive id, or with `since` and `until` for a batch. No arguments exports the latest drive.
3. Roadbook `import_drive` with the payload as `drive` (single) or `drives` (batch), plus an optional `tripId` to add to an existing trip and an optional `precision`.

The agent never has to name a place. Roadbook resolves the start and end coordinates to the nearest city or neighborhood itself.

## Schema `roadbook.drive/1`

```json
{
  "schema": "roadbook.drive/1",
  "source": { "system": "rivian", "id": "d_01J...", "vehicle_id": "7PD..." },
  "started_at": "2026-10-13T20:04:11Z",
  "ended_at": "2026-10-13T20:38:05Z",
  "timezone": "America/Denver",
  "started_at_local": "2026-10-13T14:04:11-06:00",
  "ended_at_local": "2026-10-13T14:38:05-06:00",
  "distance_km": 24.31,
  "duration_min": 34,
  "max_speed_kmh": 105,
  "elevation_gain_m": 48,
  "elevation_loss_m": 191,
  "energy_kwh": 5.69,
  "efficiency_km_per_kwh": 4.27,
  "start": {
    "lat": 40.0539, "lng": -105.2845,
    "label": "Table Mesa, Boulder, Colorado",
    "neighborhood": "Table Mesa", "city": "Boulder", "region": "Colorado",
    "country": "United States", "country_code": "US"
  },
  "end": {
    "lat": 40.1495, "lng": -105.1645,
    "label": "Longmont, Colorado",
    "neighborhood": null, "city": "Longmont", "region": "Colorado",
    "country": "United States", "country_code": "US"
  },
  "route": { "type": "LineString", "coordinates": [[-105.2845, 40.0539], [-105.2801, 40.0552]] },
  "quality": {
    "point_count": 227,
    "points_per_km": 9.3,
    "sparse": false,
    "noise": false,
    "energy_measured": true,
    "notes": []
  }
}
```

| Field                           | Meaning                                                                                                                                 |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `source`                        | Where the drive comes from. `system` + `id` is the idempotency key: importing the same drive twice changes nothing.                     |
| `started_at`, `ended_at`        | UTC, ISO 8601, second precision.                                                                                                        |
| `timezone`                      | IANA zone at the start point, from coordinates. Null only when the coordinate has no zone.                                              |
| `started_at_local`, `ended_at_local` | ISO 8601 with the UTC offset of the zone at that end. `end_timezone` is present only when the drive ends in another zone.        |
| `distance_km`                   | Sum of GPS segment distances, two decimals.                                                                                             |
| `duration_min`                  | Whole minutes between start and end.                                                                                                    |
| `max_speed_kmh`                 | Highest reported speed.                                                                                                                 |
| `elevation_gain_m`, `elevation_loss_m` | From the altitude track with 3 m hysteresis. Null when the track has no altitude.                                                |
| `energy_kwh`, `efficiency_km_per_kwh` | From the battery state of charge before and after the drive times pack capacity. Null when no sample sits within 30 min of the start or 1 min of the end. `quality.energy_measured` says which. |
| `start`, `end`                  | Precise coordinates plus a settlement-level label. Labels never contain a street, house number or building name. Any label field can be null when the geocoder knows nothing there. |
| `route`                         | GeoJSON LineString, `[lng, lat]`, Douglas-Peucker simplified to `max_points` (default 100). The first and last coordinate equal `start` and `end`. |
| `quality.point_count`           | GPS fixes the recorder stored for the drive.                                                                                            |
| `quality.points_per_km`         | Fix density. Older recordings log 5 to 25 points on a drive that now gets 150 to 280.                                                   |
| `quality.sparse`                | Under 3 points per km. The route is coarse; the distance is still the segment sum.                                                      |
| `quality.noise`                 | GPS drift while parked (under 200 m, or under 1 m/s on average). `export_drive` leaves these out unless `include_noise` is set.          |
| `quality.notes`                 | The same facts as sentences, for the agent to repeat to the user.                                                                       |

## Batch `roadbook.drives/1`

```json
{ "schema": "roadbook.drives/1", "drives": [ { "schema": "roadbook.drive/1", "...": "..." } ] }
```

Drives are in start order. A date range stops after 50 drives and says so in the text; narrow the range for the rest.

## Privacy

Drive starts and ends are often home or work.

- Roadbook defaults every imported trip to private.
- Roadbook stores the precise start and end coordinates only on the private drive leg. The public place of each stop is the city or neighborhood centroid, and `import_drive` takes `precision: "city"` to keep nothing finer than that at all.
- Labels on this side stop at the neighborhood, so a label pasted into a chat does not name a street.
- The geocoder (Photon, komoot) receives the coordinate rounded to about 100 m and nothing else.

## Other formats

`export_drive` also returns `geojson` (a Feature with the route as geometry and every other field as properties; a FeatureCollection for a range) and `gpx` (GPX 1.1, one track per drive, with time and elevation per point).
