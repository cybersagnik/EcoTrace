const { Pool } = require('pg');
const http = require('http');

require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://ecotrace:[REDACTED]@postgres:5432/ecotrace';
const ATTRIBUTION_INTERVAL_MS = parseInt(process.env.ATTRIBUTION_INTERVAL_MS || '30000');
const AGGREGATION_INTERVAL_MS = parseInt(process.env.AGGREGATION_INTERVAL_MS || '300000');
const PORT = 3004;

// Constants from spec
const TDP_W = 45;           // Thermal design power
const BASE_W = 10;          // Idle system draw
const EMISSION_FACTOR = 0.233; // kg CO₂ per kWh (CEA India 2022-23)
const DEFAULT_DURATION_S = 30; // seconds, if window fields missing

const pool = new Pool({ connectionString: DATABASE_URL });

let processedCount = 0;

// ═══════════════════════════════════════════════════════════════
// ATTRIBUTION PIPELINE
// ═══════════════════════════════════════════════════════════════
async function runAttribution() {
  try {
    const client = await pool.connect();
    
    // Find unprocessed rows: in emissions_raw but NOT in emissions_calculated
    const query = `
      SELECT er.id, er.device_id, er.timestamp, er.cpu_usage, er.raw_payload
      FROM emissions_raw er
      WHERE NOT EXISTS (
        SELECT 1 FROM emissions_calculated ec
        WHERE ec.device_id = er.device_id AND ec.timestamp = er.timestamp
      )
      ORDER BY er.id ASC
      LIMIT 1000
    `;
    
    const result = await client.query(query);
    const rows = result.rows;
    
    if (rows.length === 0) {
      client.release();
      return;
    }
    
    console.log(`[attribution-engine] Processing ${rows.length} unprocessed rows`);
    
    // Process each row through attribution formula
    const attributionResults = [];
    for (const row of rows) {
      const { id, device_id, timestamp, cpu_usage, raw_payload } = row;
      
      // Extract window times from raw_payload if available
      let window_start_ms = null;
      let window_end_ms = null;
      
      if (raw_payload && typeof raw_payload === 'object') {
        window_start_ms = raw_payload.window_start_ms;
        window_end_ms = raw_payload.window_end_ms;
      }
      
      // Calculate duration_h
      let duration_h = DEFAULT_DURATION_S / 3600; // default: 30s → 0.008333h
      
      if (window_start_ms && window_end_ms) {
        const duration_ms = window_end_ms - window_start_ms;
        if (duration_ms > 0) {
          duration_h = duration_ms / 3_600_000;
        }
      }
      
      // Calculate energy_wh using formula: (cpu%/100 * TDP + BASE) * duration_h
      const cpu_fraction = (cpu_usage || 0) / 100;
      const power_w = cpu_fraction * TDP_W + BASE_W;
      const energy_wh = power_w * duration_h;
      
      // Calculate carbon_g using formula: energy_wh * EMISSION_FACTOR * 1000
      const carbon_g = energy_wh * EMISSION_FACTOR * 1000;
      
      attributionResults.push({
        device_id,
        timestamp,
        energy_wh: parseFloat(energy_wh.toFixed(6)),
        carbon_g: parseFloat(carbon_g.toFixed(6)),
        raw_id: id
      });
      
      // Spot-check log (TASK B2 requirement: log formula inputs & result)
      if (cpu_usage !== null && cpu_usage !== undefined) {
        console.log(
          `[attribution-engine] SPOT-CHECK id=${id} device=${device_id} ` +
          `cpu_usage=${cpu_usage}% duration_h=${duration_h.toFixed(6)} → ` +
          `energy_wh=${energy_wh.toFixed(6)} carbon_g=${carbon_g.toFixed(6)}`
        );
      }
    }
    
    // Batch insert into emissions_calculated
    if (attributionResults.length > 0) {
      const insertQuery = `
        INSERT INTO emissions_calculated (device_id, timestamp, energy_wh, carbon_g, model_id, created_at)
        VALUES ($1, $2, $3, $4, 'ecotrace-attribution-v0.1', NOW())
      `;
      
      for (const result of attributionResults) {
        await client.query(insertQuery, [
          result.device_id,
          result.timestamp,
          result.energy_wh,
          result.carbon_g
        ]);
      }
      
      processedCount += attributionResults.length;
      console.log(`[attribution-engine] Inserted ${attributionResults.length} rows. Total processed: ${processedCount}`);
    }
    
    client.release();
  } catch (err) {
    console.error('[attribution-engine] Attribution run failed:', err);
  }
}

// ═══════════════════════════════════════════════════════════════
// AGGREGATION PIPELINE (5-minute interval)
// ═══════════════════════════════════════════════════════════════
async function runAggregation() {
  try {
    const client = await pool.connect();
    
    const query = `
      INSERT INTO daily_summaries (device_id, date, carbon_g, energy_wh, sample_count, updated_at)
      SELECT
        device_id,
        DATE(timestamp) as date,
        SUM(carbon_g)   as carbon_g,
        SUM(energy_wh)  as energy_wh,
        COUNT(*)        as sample_count,
        NOW()           as updated_at
      FROM emissions_calculated
      WHERE timestamp >= NOW() - INTERVAL '25 hours'
      GROUP BY device_id, DATE(timestamp)
      ON CONFLICT (device_id, date)
      DO UPDATE SET
        carbon_g     = EXCLUDED.carbon_g,
        energy_wh    = EXCLUDED.energy_wh,
        sample_count = EXCLUDED.sample_count,
        updated_at   = NOW()
    `;
    
    const result = await client.query(query);
    console.log(`[attribution-engine] Aggregation complete. Rows affected: ${result.rowCount}`);
    
    client.release();
  } catch (err) {
    console.error('[attribution-engine] Aggregation failed:', err);
  }
}

// ═══════════════════════════════════════════════════════════════
// HEALTH CHECK ENDPOINT
// ═══════════════════════════════════════════════════════════════
const server = http.createServer(async (req, res) => {
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      processed_count: processedCount,
      timestamp: new Date().toISOString()
    }));
  } else {
    res.writeHead(404);
    res.end();
  }
});

// ═══════════════════════════════════════════════════════════════
// STARTUP
// ═══════════════════════════════════════════════════════════════
server.listen(PORT, () => {
  console.log(`[attribution-engine] Health endpoint listening on port ${PORT}`);
});

// Start attribution pipeline (every 30 seconds)
setInterval(() => {
  runAttribution().catch(err => console.error('[attribution-engine] Unhandled error:', err));
}, ATTRIBUTION_INTERVAL_MS);

// Start aggregation pipeline (every 5 minutes)
setInterval(() => {
  runAggregation().catch(err => console.error('[attribution-engine] Aggregation error:', err));
}, AGGREGATION_INTERVAL_MS);

// Run once immediately on startup
console.log('[attribution-engine] Initializing...');
runAttribution().catch(err => console.error('[attribution-engine] Initial attribution failed:', err));
runAggregation().catch(err => console.error('[attribution-engine] Initial aggregation failed:', err));

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[attribution-engine] SIGTERM received, shutting down...');
  server.close(() => {
    pool.end(() => process.exit(0));
  });
});
