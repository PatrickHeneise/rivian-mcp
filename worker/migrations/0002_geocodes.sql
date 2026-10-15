-- Reverse geocoding cache: one row per rounded coordinate (3 decimals, about 100 m).
-- `data` is the JSON place info parsed from the geocoder, so a drive's start and end
-- are looked up once and never again.
CREATE TABLE geocodes (
  key TEXT PRIMARY KEY,
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  data TEXT NOT NULL,
  fetched_at INTEGER NOT NULL -- Unix epoch ms
);
