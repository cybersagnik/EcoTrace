-- 006_service_attribution.sql
-- Phase 1 + Phase 2 of the carbon-accuracy plan:
--   1. Per-device power model (rated_tdp_w / base_power_w) so the
--      attribution engine no longer uses one shared TDP for every device.
--   2. emissions_by_service table for per-workload carbon attribution —
--      the attribution engine splits each device's variable energy across
--      services mapped by the agent (systemd units / process names).

ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS rated_tdp_w INT NOT NULL DEFAULT 45,
  ADD COLUMN IF NOT EXISTS base_power_w INT NOT NULL DEFAULT 10;

CREATE TABLE IF NOT EXISTS emissions_by_service (
  id           BIGSERIAL PRIMARY KEY,
  device_id    TEXT NOT NULL,
  service      TEXT NOT NULL,
  date         DATE NOT NULL,
  energy_wh    DOUBLE PRECISION NOT NULL DEFAULT 0,
  carbon_g     DOUBLE PRECISION NOT NULL DEFAULT 0,
  sample_count INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (device_id, service, date)
);

CREATE INDEX IF NOT EXISTS idx_emissions_by_service_device_date
  ON emissions_by_service (device_id, date);

CREATE INDEX IF NOT EXISTS idx_emissions_by_service_service_date
  ON emissions_by_service (service, date);
