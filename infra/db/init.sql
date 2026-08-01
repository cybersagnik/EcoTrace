-- ── DEVICES ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS devices (
  device_id      TEXT        PRIMARY KEY,
  device_class   TEXT        NOT NULL CHECK (device_class IN ('linux','windows','iot','plc')),
  os             TEXT,
  hostname       TEXT,
  status         TEXT        NOT NULL DEFAULT 'active'
                             CHECK (status IN ('active','idle','revoked')),
  registered_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at   TIMESTAMPTZ
);

-- ── RAW TELEMETRY ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS emissions_raw (
  id               BIGSERIAL   PRIMARY KEY,
  device_id        TEXT        NOT NULL REFERENCES devices(device_id),
  schema_version   TEXT        NOT NULL,
  timestamp        TIMESTAMPTZ NOT NULL,
  cpu_usage        FLOAT       CHECK (cpu_usage BETWEEN 0 AND 100),
  memory_usage     FLOAT       CHECK (memory_usage BETWEEN 0 AND 100),
  network_sent     BIGINT,
  network_received BIGINT,
  raw_payload      JSONB,
  ingested_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_emissions_raw_device_ts
  ON emissions_raw (device_id, timestamp DESC);

-- ── CALCULATED EMISSIONS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS emissions_calculated (
  id          BIGSERIAL   PRIMARY KEY,
  device_id   TEXT        NOT NULL REFERENCES devices(device_id),
  timestamp   TIMESTAMPTZ NOT NULL,
  energy_wh   FLOAT       NOT NULL,
  carbon_g    FLOAT       NOT NULL,
  model_id    TEXT        NOT NULL DEFAULT 'ecotrace-attribution-v0.1',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_emissions_calc_device_ts
  ON emissions_calculated (device_id, timestamp DESC);

-- ── DAILY SUMMARIES ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_summaries (
  device_id   TEXT  NOT NULL REFERENCES devices(device_id),
  date        DATE  NOT NULL,
  carbon_g    FLOAT NOT NULL DEFAULT 0,
  energy_wh   FLOAT NOT NULL DEFAULT 0,
  sample_count INT  NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (device_id, date)
);

-- ── AUDIT LOG ─────────────────────────────────────────────────────────────
-- Minimal audit trail: registration, revocation, token events
CREATE TABLE IF NOT EXISTS audit_log (
  id         BIGSERIAL   PRIMARY KEY,
  event_type TEXT        NOT NULL,
  device_id  TEXT,
  actor      TEXT,
  metadata   JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);