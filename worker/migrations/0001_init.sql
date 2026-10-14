-- One row per drive. Stats and lists read this table, never `points`.
CREATE TABLE drives (
  id TEXT PRIMARY KEY,
  vehicle_id TEXT NOT NULL,
  started_at INTEGER NOT NULL, -- Unix epoch ms
  ended_at INTEGER,            -- null while the drive is open
  start_lat REAL NOT NULL,
  start_lon REAL NOT NULL,
  end_lat REAL NOT NULL,
  end_lon REAL NOT NULL,
  start_odometer_km INTEGER,
  end_odometer_km INTEGER,
  distance_m REAL NOT NULL DEFAULT 0,
  max_speed_mps REAL NOT NULL DEFAULT 0,
  point_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_drives_vehicle_started ON drives (vehicle_id, started_at);

-- GPS points, one every 5 s while driving. WITHOUT ROWID keys rows by
-- (drive_id, ts), so each point is one written row and no extra index row.
CREATE TABLE points (
  drive_id TEXT NOT NULL,
  ts INTEGER NOT NULL, -- Unix epoch ms
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  alt REAL,
  speed_mps REAL,
  bearing REAL,
  PRIMARY KEY (drive_id, ts)
) WITHOUT ROWID;

-- Charging telemetry, at most one row per RVM per minute plus every status change.
-- `data` is the decoded JSON; `payload` keeps the raw base64 protobuf, because the
-- charging field numbers are not confirmed live yet.
CREATE TABLE charge_samples (
  vehicle_id TEXT NOT NULL,
  ts INTEGER NOT NULL, -- Unix epoch ms, from the message
  rvm TEXT NOT NULL,
  data TEXT NOT NULL,
  payload TEXT NOT NULL,
  PRIMARY KEY (vehicle_id, ts, rvm)
) WITHOUT ROWID;

CREATE INDEX idx_charge_samples_ts ON charge_samples (ts);
