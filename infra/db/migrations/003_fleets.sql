-- Phase 3 Migration: Fleets — user-managed logical groupings of devices.
--
-- Devices now belong to a fleet (or none). Until a fleet is created,
-- every device is unassigned (fleet_id IS NULL). This matches the
-- user's requirement that "initially fleet should be empty" and that
-- devices must NOT be auto-assigned to any default region.

CREATE TABLE IF NOT EXISTS fleets (
  id                           BIGSERIAL    PRIMARY KEY,
  name                         TEXT         NOT NULL UNIQUE,
  description                  TEXT,
  grid_region                  TEXT         NOT NULL,
  grid_intensity_g_per_kwh     FLOAT        NOT NULL DEFAULT 240.0,
  created_at                   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at                   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fleets_name ON fleets (name);

ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS fleet_id BIGINT REFERENCES fleets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_devices_fleet_id ON devices (fleet_id) WHERE fleet_id IS NOT NULL;
