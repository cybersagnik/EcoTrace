-- Phase 7 Migration: AI Advisor — cloud-inference alert insights.
--
-- A dedicated background service (services/ai-advisor) pulls a compact
-- data snapshot from Postgres on a schedule, sends it to Google Gemini
-- for analysis, and persists the resulting insights here. The REST API
-- merges active insights into the main /api/alerts feed, tagged with
-- source 'ai'.
--
-- Fingerprint dedupes identical insights across runs (same category +
-- device + normalized message), so scheduled re-analysis never floods the
-- feed. Insights expire 48h after creation and roll off the feed.

CREATE TABLE IF NOT EXISTS ai_alerts (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint    TEXT        NOT NULL UNIQUE,
  severity       TEXT        NOT NULL CHECK (severity IN ('critical','warning','info')),
  title          TEXT        NOT NULL,
  message        TEXT        NOT NULL,
  category       TEXT,
  device_id      TEXT,
  confidence     NUMERIC(3,2),
  evidence       JSONB,
  recommendation TEXT,
  source         TEXT        NOT NULL DEFAULT 'gemini',
  status         TEXT        NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active','expired','dismissed')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at     TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '48 hours'
);

CREATE INDEX IF NOT EXISTS idx_ai_alerts_active
  ON ai_alerts (status) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_ai_alerts_created_at
  ON ai_alerts (created_at DESC);