'use strict';

const { connect, StringCodec, JSONCodec } = require('nats');
const { Pool } = require('pg');
const { validate } = require('./validator');

const NATS_URL    = process.env.NATS_URL    || 'nats://nats:4222';
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('[ingestion-worker] FATAL: DATABASE_URL not set');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });
const sc   = StringCodec();

// Metrics counters for health monitoring
let stats = { received: 0, validated: 0, rejected: 0, dbErrors: 0 };

async function start() {
  // Wait for DB to be reachable
  await waitForDB();

  const nc = await connect({ servers: NATS_URL });
  console.log(`[ingestion-worker] connected to NATS at ${NATS_URL}`);

  const sub = nc.subscribe('telemetry.raw');
  console.log('[ingestion-worker] subscribed to telemetry.raw');

  for await (const msg of sub) {
    stats.received++;
    await processMessage(msg);
  }
}

async function processMessage(msg) {
  let parsed;
  try {
    parsed = JSON.parse(sc.decode(msg.data));
  } catch (err) {
    stats.rejected++;
    console.error('[ingestion-worker] failed to parse message:', err.message);
    return;
  }

  // The ingestion-http service wraps the payload — extract the ecotrace envelope
  // from the _ecotrace_envelope field if present, otherwise try direct parse
  const envelope = parsed._ecotrace_envelope || extractFromOTLP(parsed);

  if (!envelope) {
    stats.rejected++;
    console.error('[ingestion-worker] no extractable envelope in message');
    return;
  }

  // SECURITY: extract JWT device_id from message metadata if ingestion-http forwards it
  const jwtDeviceId = parsed.device_id || null;

  // Validate
  const result = validate(envelope, jwtDeviceId);
  if (!result.valid) {
    stats.rejected++;
    console.warn(`[ingestion-worker] REJECTED device_id=${envelope.device_id || 'unknown'} reason=${result.reason}`);
    // Audit log the rejection — SECURITY: helps detect compromised agents
    await logAuditEvent('envelope.rejected', envelope.device_id, { reason: result.reason });
    return;
  }

  stats.validated++;

  // Ensure device exists in registry (upsert last_seen_at)
  await upsertDevice(envelope);

  // Insert into emissions_raw
  await insertEmissionsRaw(envelope);
}

// ── Database Operations ───────────────────────────────────────────────────────

async function upsertDevice(envelope) {
  try {
    await pool.query(
      `INSERT INTO devices (device_id, device_class, os, hostname, status, last_seen_at)
       VALUES ($1, $2, $3, $4, 'active', NOW())
       ON CONFLICT (device_id) DO UPDATE
         SET last_seen_at = NOW(),
             status = CASE WHEN devices.status = 'revoked' THEN 'revoked' ELSE 'active' END`,
      [envelope.device_id, envelope.device_class, envelope.operating_system, envelope.hostname]
    );
  } catch (err) {
    // Non-fatal — device may not be in registry yet, log and continue
    console.warn(`[ingestion-worker] device upsert warning device_id=${envelope.device_id}: ${err.message}`);
  }
}

async function insertEmissionsRaw(envelope) {
  try {
    // Use window_end_ms as the collection timestamp
    const timestamp = new Date(parseInt(envelope.window_end_ms));
    
    await pool.query(
      `INSERT INTO emissions_raw
         (device_id, schema_version, timestamp, cpu_usage, memory_usage,
          network_sent, network_received, raw_payload, ingested_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [
        envelope.device_id,
        envelope.schema_version || '1.0',
        timestamp,
        parseFloat(envelope.cpu_usage),
        parseFloat(envelope.memory_usage),
        parseInt(envelope.network_sent),
        parseInt(envelope.network_received),
        JSON.stringify(envelope),
      ]
    );
    console.log(`[ingestion-worker] inserted emissions_raw device_id=${envelope.device_id} cpu=${parseFloat(envelope.cpu_usage).toFixed(1)}% mem=${parseFloat(envelope.memory_usage).toFixed(1)}%`);
    stats.validated++;

    // Audit log successful ingestion
    await logAuditEvent('envelope.received', envelope.device_id, {
      cpu_usage: envelope.cpu_usage,
      schema_version: envelope.schema_version,
    });
  } catch (err) {
    stats.dbErrors++;
    console.error(`[ingestion-worker] DB insert error device_id=${envelope.device_id}: ${err.message}`);
  }
}

async function logAuditEvent(eventType, deviceId, metadata) {
  try {
    await pool.query(
      `INSERT INTO audit_log (event_type, device_id, metadata) VALUES ($1, $2, $3)`,
      [eventType, deviceId, JSON.stringify(metadata)]
    );
  } catch (err) {
    // Audit log failure is non-fatal but should be visible
    console.error(`[ingestion-worker] audit log failed: ${err.message}`);
  }
}

// ── OTLP Extraction ───────────────────────────────────────────────────────────

function extractFromOTLP(payload) {
  try {
    const spans = payload?.resourceSpans?.[0]?.scopeSpans?.[0]?.spans?.[0];
    if (!spans) return null;

    const attrs = {};
    for (const attr of spans.attributes || []) {
      const val = attr.value;
      attrs[attr.key] = val.stringValue ?? val.doubleValue ?? val.intValue ?? null;
    }

    const resource = {};
    for (const attr of payload?.resourceSpans?.[0]?.resource?.attributes || []) {
      resource[attr.key] = attr.value.stringValue;
    }

    return {
      device_id:        attrs.device_id || resource.device_id,
      device_class:     attrs.device_class || 'linux',
      schema_version:   attrs.schema_version || '1.0',
      cpu_usage:        attrs.cpu_usage || 0,
      memory_usage:     attrs.memory_usage || 0,
      network_sent:     attrs.network_sent || 0,
      network_received: attrs.network_received || 0,
      operating_system: attrs.os || 'linux',
      hostname:         attrs.hostname || 'unknown',
      window_start_ms:  parseInt(spans.startTimeUnixNano) / 1e6,
      window_end_ms:    parseInt(spans.endTimeUnixNano)   / 1e6,
    };
  } catch {
    return null;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function waitForDB(retries = 10, delay = 3000) {
  for (let i = 0; i < retries; i++) {
    try {
      await pool.query('SELECT 1');
      console.log('[ingestion-worker] database connected');
      return;
    } catch (err) {
      console.log(`[ingestion-worker] waiting for DB (attempt ${i+1}/${retries}): ${err.message}`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  console.error('[ingestion-worker] FATAL: could not connect to database');
  process.exit(1);
}

// Health stats endpoint — useful for monitoring
setInterval(() => {
  console.log(`[ingestion-worker] stats: received=${stats.received} validated=${stats.validated} rejected=${stats.rejected} db_errors=${stats.dbErrors}`);
}, 60_000);

start().catch(err => {
  console.error('[ingestion-worker] FATAL:', err);
  process.exit(1);
});
