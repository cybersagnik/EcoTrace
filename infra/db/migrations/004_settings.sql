-- Phase 4 Migration: Platform settings — persisted key/value store for
-- user-managed preferences surfaced by the Settings page.
--
-- Keys stored:
--   daily_limit_kg                 FLOAT  (kg CO2e daily fleet budget)
--   intensity_threshold_g_per_kwh  FLOAT  (clean grid intensity threshold)
--   grid_provider_token            TEXT   (WattTime / ElectricityMaps token,
--                                         never returned in full by the API)

CREATE TABLE IF NOT EXISTS settings (
  key        TEXT        PRIMARY KEY,
  value      JSONB       NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
