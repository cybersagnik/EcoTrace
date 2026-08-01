-- Phase 2 Migration: Indexes for Attribution & Aggregation queries
-- Applied after Phase 1 schema is in place

-- Index for fast lookup of unprocessed emissions (TASK B1: Attribution Engine)
CREATE INDEX IF NOT EXISTS idx_emissions_raw_unprocessed 
  ON emissions_raw (device_id, timestamp)
  WHERE id NOT IN (SELECT emissions_raw.id FROM emissions_raw 
                   INNER JOIN emissions_calculated ON emissions_raw.device_id = emissions_calculated.device_id 
                   AND emissions_raw.timestamp = emissions_calculated.timestamp);

-- Index for aggregation query (TASK B3: 25-hour lookback on emissions_calculated)
CREATE INDEX IF NOT EXISTS idx_emissions_calculated_timestamp 
  ON emissions_calculated (device_id, timestamp DESC);

-- Index for daily_summaries upsert and /api/devices query
CREATE INDEX IF NOT EXISTS idx_daily_summaries_date 
  ON daily_summaries (date DESC, device_id);

-- Index for /api/fleet aggregation (active devices by date)
CREATE INDEX IF NOT EXISTS idx_devices_status_active 
  ON devices (status) 
  WHERE status = 'active';

-- Index for audit log queries by event type
CREATE INDEX IF NOT EXISTS idx_audit_log_event_type 
  ON audit_log (event_type, created_at DESC);

-- Index for audit log device revocation lookups
CREATE INDEX IF NOT EXISTS idx_audit_log_device_id 
  ON audit_log (device_id, event_type);

-- Composite index for /api/devices/:id/history query
CREATE INDEX IF NOT EXISTS idx_emissions_calculated_device_timestamp 
  ON emissions_calculated (device_id, timestamp DESC);
