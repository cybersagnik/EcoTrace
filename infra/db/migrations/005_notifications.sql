-- Phase 5 Migration: Agent notifications + registration consent.
--
-- Devices can now opt in to receive control-plane notifications. The agent
-- declares its consent/channel at registration time (Registration Service
-- stores it). The dashboard may only notify devices whose consent is true.

ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS notification_consent          BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notification_channel          TEXT,
  ADD COLUMN IF NOT EXISTS notification_poll_interval_s  INT     NOT NULL DEFAULT 30;

CREATE TABLE IF NOT EXISTS agent_notifications (
  id            BIGSERIAL   PRIMARY KEY,
  device_id     TEXT        NOT NULL REFERENCES devices(device_id),
  title         TEXT        NOT NULL,
  message       TEXT        NOT NULL,
  severity      TEXT        NOT NULL DEFAULT 'info'
                CHECK (severity IN ('info','warning','critical')),
  status        TEXT        NOT NULL DEFAULT 'queued'
                CHECK (status IN ('queued','delivered','seen')),
  dedupe_key    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at  TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);

CREATE INDEX IF NOT EXISTS idx_notifications_device_status
  ON agent_notifications (device_id, status);

-- One active notification per device per dedupe key (e.g. one
-- "optimize" recommendation per device per day).
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_dedupe
  ON agent_notifications (device_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;
