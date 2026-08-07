const { Pool } = require('pg');
const http = require('http');

require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://ecotrace:[REDACTED]@postgres:5432/ecotrace';
const ATTRIBUTION_INTERVAL_MS = parseInt(process.env.ATTRIBUTION_INTERVAL_MS || '30000');
const AGGREGATION_INTERVAL_MS = parseInt(process.env.AGGREGATION_INTERVAL_MS || '300000');
const PORT = 3004;

// Model constants. Per-device rated TDP / base power come from the devices
// table (set at registration, device-class aware). Grid intensity comes from
// the device's assigned fleet; unassigned devices fall back to a regional
// default. These are only the memory/network coefficients of the model.
const RAM_W_PER_GB = 4.0;      // ~4W per GB of used RAM
const RAM_TOTAL_GB = 16.0;     // model machine size for mem-fraction → GB
const NET_W_PER_GB_H = 0.5;    // 0.5W per GB transferred per hour
const INTENSITY_DEFAULT = 240; // g CO2e per kWh for unassigned devices
const DEFAULT_DURATION_S = 30; // seconds, if window fields missing

const pool = new Pool({ connectionString: DATABASE_URL });

let processedCount = 0;

// ═══════════════════════════════════════════════════════════════
// ATTRIBUTION PIPELINE
// ═══════════════════════════════════════════════════════════════
async function runAttribution() {
  try {
    const client = await pool.connect();
    
    // Find unprocessed rows: in emissions_raw but NOT in emissions_calculated.
    // JOIN devices for the per-device power model and fleets for the grid
    // intensity so attribution uses the device's own rating + grid region.
    const query = `
      SELECT er.id, er.device_id, er.timestamp, er.cpu_usage, er.memory_usage,
             er.network_sent, er.network_received, er.raw_payload,
             d.rated_tdp_w, d.base_power_w,
             COALESCE(f.grid_intensity_g_per_kwh, ${INTENSITY_DEFAULT}) as grid_intensity
      FROM emissions_raw er
      JOIN devices d ON d.device_id = er.device_id
      LEFT JOIN fleets f ON f.id = d.fleet_id
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
    const serviceAgg = {}; // key: `${device_id}|${service}` → {energy, carbon, samples}
    
    for (const row of rows) {
      const { id, device_id, timestamp, cpu_usage, memory_usage, raw_payload } = row;
      const tdp_w  = parseFloat(row.rated_tdp_w)  || 45;
      const base_w = parseFloat(row.base_power_w) || 10;
      const intensity = parseFloat(row.grid_intensity) || INTENSITY_DEFAULT;
      const cpu_frac = Math.min(1, (parseFloat(cpu_usage) || 0) / 100);
      const mem_frac = Math.min(1, (parseFloat(memory_usage) || 0) / 100);
      const net_bytes = (parseInt(row.network_sent, 10) || 0) + (parseInt(row.network_received, 10) || 0);
      
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
      
      // ── Power model (v0.2): idle base + CPU + memory + network ──
      //   power_w  = base_w + cpu%·TDP + mem_frac·RAM_GB·RAM_W/GB
      //   net_wh   = GB transferred × NET_W_PER_GB_H (per-hour rate × duration)
      //   energy_wh = (power_w + net_w) × duration_h
      const cpu_w  = cpu_frac * tdp_w;
      const mem_w  = mem_frac * RAM_TOTAL_GB * RAM_W_PER_GB;
      const power_w = base_w + cpu_w + mem_w;
      const net_w   = (net_bytes / 1e9) * NET_W_PER_GB_H;
      const energy_wh = (power_w + net_w) * duration_h;
      
      // carbon_g = energy_wh × grid_intensity (g/kWh) / 1000
      const carbon_g = energy_wh * intensity / 1000;
      
      attributionResults.push({
        device_id,
        timestamp,
        energy_wh: parseFloat(energy_wh.toFixed(6)),
        carbon_g: parseFloat(carbon_g.toFixed(6)),
        raw_id: id
      });
      
      // ── Service attribution (Phase 2) ─────────────────────────
      // Split the VARIABLE energy (CPU + memory — the load-driven part)
      // across processes weighted 70% CPU share / 30% RSS share. The idle
      // base draw is overhead and is NOT attributed to any workload.
      const processes = raw_payload?.processes || [];
      if (processes.length > 0) {
        const varEnergyWh = (cpu_w + mem_w) * duration_h;
        const sumCpu = processes.reduce((s, p) => s + (parseFloat(p.cpu_percent) || 0), 0);
        const sumRss = processes.reduce((s, p) => s + (parseInt(p.rss_bytes, 10) || 0), 0);
        for (const p of processes) {
          const cpuShare = sumCpu > 0 ? (parseFloat(p.cpu_percent) || 0) / sumCpu : 0;
          const rssShare = sumRss > 0 ? (parseInt(p.rss_bytes, 10) || 0) / sumRss : 0;
          const weight = 0.7 * cpuShare + 0.3 * rssShare;
          if (weight <= 0) continue;
          const service = (p.service || p.name || 'unknown').slice(0, 128);
          const sEnergy = varEnergyWh * weight;
          const sCarbon = sEnergy * intensity / 1000;
          const key = `${device_id}|${service}`;
          if (!serviceAgg[key]) {
            serviceAgg[key] = { device_id, service, energy: 0, carbon: 0, samples: 0 };
          }
          serviceAgg[key].energy += sEnergy;
          serviceAgg[key].carbon += sCarbon;
          serviceAgg[key].samples += 1;
        }
      }
      
      // Spot-check log (TASK B2 requirement: log formula inputs & result)
      if (cpu_usage !== null && cpu_usage !== undefined) {
        console.log(
          `[attribution-engine] SPOT-CHECK id=${id} device=${device_id} ` +
          `cpu=${cpu_usage}% mem=${(mem_frac * 100).toFixed(1)}% tdp=${tdp_w}W base=${base_w}W ` +
          `intensity=${intensity} g/kWh duration_h=${duration_h.toFixed(6)} → ` +
          `energy_wh=${energy_wh.toFixed(6)} carbon_g=${carbon_g.toFixed(6)}`
        );
      }
    }
    
    // Batch insert into emissions_calculated
    if (attributionResults.length > 0) {
      const insertQuery = `
        INSERT INTO emissions_calculated (device_id, timestamp, energy_wh, carbon_g, model_id, created_at)
        VALUES ($1, $2, $3, $4, 'ecotrace-attribution-v0.2', NOW())
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
    
    // Upsert per-service aggregates for today
    const serviceKeys = Object.keys(serviceAgg);
    if (serviceKeys.length > 0) {
      const upsertQ = `
        INSERT INTO emissions_by_service (device_id, service, date, energy_wh, carbon_g, sample_count, updated_at)
        VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, NOW())
        ON CONFLICT (device_id, service, date) DO UPDATE SET
          energy_wh    = emissions_by_service.energy_wh + EXCLUDED.energy_wh,
          carbon_g     = emissions_by_service.carbon_g + EXCLUDED.carbon_g,
          sample_count = emissions_by_service.sample_count + EXCLUDED.sample_count,
          updated_at   = NOW()
      `;
      for (const key of serviceKeys) {
        const s = serviceAgg[key];
        if (s.energy <= 0 && s.carbon <= 0) continue;
        await client.query(upsertQ, [
          s.device_id, s.service,
          parseFloat(s.energy.toFixed(6)),
          parseFloat(s.carbon.toFixed(6)),
          s.samples,
        ]);
      }
      console.log(`[attribution-engine] Upserted ${Object.keys(serviceAgg).length} service attributions`);
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
