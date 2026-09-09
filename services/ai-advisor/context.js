// services/ai-advisor/context.js
// ─────────────────────────────────────────────────────────────────────
// Builds the compact, token-aware data snapshot that the scheduled
// analysis sends to Gemini. Everything here is aggregated telemetry —
// NO credentials, tokens, or raw payload blobs ever cross the wire.
//
// The fingerprint is a hash of the serialized context; the scheduler
// skips a Gemini call when nothing changed (cost control).

const crypto = require('crypto');

const RUNNING_WINDOW_MINUTES = 10;

function num(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function summarize({ summaries, today, yesterday }) {
  // Last 14 days of daily_summaries → per-device rollup + trend deltas.
  const byDevice = {};
  let totalYesterday = 0;
  let totalToday = 0;

  for (const s of summaries) {
    const d = String(s.device_id);
    const byDate = byDevice[d] || (byDevice[d] = {});
    byDate[String(s.date)] = { carbon_g: num(s.carbon_g), energy_wh: num(s.energy_wh) };

    const isToday = String(s.date) === String(today)?.slice(0, 10);
    if (isToday) {
      totalToday += num(s.carbon_g);
    } else if (String(s.date) === String(yesterday)?.slice(0, 10)) {
      totalYesterday += num(s.carbon_g);
    }
  }

  return {
    total_today_carbon_g: Math.round(totalToday),
    total_yesterday_carbon_g: Math.round(totalYesterday),
    delta_vs_yesterday_pct:
      totalYesterday > 0 ? Math.round(((totalToday - totalYesterday) / totalYesterday) * 100) : null,
    devices: Object.entries(byDevice).map(([device_id, byDate]) => {
      const dates = Object.keys(byDate).sort();
      const today = byDate[dates[dates.length - 1]];
      const prev = dates.length > 1 ? byDate[dates[dates.length - 2]] : null;
      return {
        device_id,
        latest_date: dates[dates.length - 1],
        carbon_g: Math.round(num(today?.carbon_g)),
        energy_wh: Math.round(num(today?.energy_wh)),
        delta_vs_prev_day_pct:
          prev && num(prev.carbon_g) > 0
            ? Math.round(((num(today?.carbon_g) - num(prev.carbon_g)) / num(prev.carbon_g)) * 100)
            : null,
      };
    }),
  };
}

async function buildContext({ pool }) {
  const [devices, fleets, settings, summaries, services, activeAi, audit, today, yesterday] =
    await Promise.all([
      pool.query(`SELECT device_id, device_class, hostname, status, last_seen_at, fleet_id,
                         COALESCE(rated_tdp_w, 0) AS rated_tdp_w,
                         COALESCE(base_power_w, 0) AS base_power_w
                  FROM devices WHERE status != 'revoked'`),
      pool.query(`SELECT id, name, grid_region, grid_intensity_g_per_kwh, description
                  FROM fleets ORDER BY name`),
      pool.query(`SELECT key, value FROM settings`),
      pool.query(`SELECT device_id, date, carbon_g, energy_wh
                  FROM daily_summaries
                  WHERE date >= CURRENT_DATE - INTERVAL '13 days'
                  ORDER BY device_id, date`),
      pool.query(`SELECT service, device_id, date, carbon_g, energy_wh, sample_count
                  FROM emissions_by_service
                  WHERE date >= CURRENT_DATE - INTERVAL '7 days'
                  ORDER BY carbon_g DESC LIMIT 40`),
      pool.query(`SELECT title, message, severity, category, device_id, created_at
                  FROM ai_alerts
                  WHERE status = 'active' AND created_at >= NOW() - INTERVAL '48 hours'
                  ORDER BY created_at DESC LIMIT 10`),
      pool.query(`SELECT event_type, device_id, actor, metadata, created_at
                  FROM audit_log
                  WHERE created_at >= NOW() - INTERVAL '24 hours'
                  ORDER BY created_at DESC LIMIT 20`),
      pool.query(`SELECT CURRENT_DATE::text AS d`),
      pool.query(`SELECT (CURRENT_DATE - 1)::text AS d`),
    ]);

  const deviceRows = devices.rows.map((d) => ({
    device_id: d.device_id,
    device_class: d.device_class,
    hostname: d.hostname,
    status: d.status,
    last_seen_at: d.last_seen_at,
    offline: d.last_seen_at === null || new Date(d.last_seen_at).getTime() < Date.now() - RUNNING_WINDOW_MINUTES * 60000,
    fleet_id: d.fleet_id,
    rated_tdp_w: num(d.rated_tdp_w),
    base_power_w: num(d.base_power_w),
  }));

  const fleetRows = fleets.rows.map((f) => ({
    id: f.id,
    name: f.name,
    grid_region: f.grid_region,
    grid_intensity_g_per_kwh: num(f.grid_intensity_g_per_kwh),
  }));

  const settingsMap = {};
  for (const s of settings.rows) {
    settingsMap[s.key] = s.value;
  }

  const context = {
    generated_at: new Date().toISOString(),
    today: today.rows[0]?.d,
    device_count: deviceRows.length,
    devices: deviceRows,
    fleets: fleetRows,
    summary: summarize({
      summaries: summaries.rows,
      today: today.rows[0]?.d,
      yesterday: yesterday.rows[0]?.d,
    }),
    top_services_by_carbon: services.rows.map((s) => ({
      device_id: s.device_id,
      service: String(s.service).slice(0, 48),
      carbon_g: Math.round(num(s.carbon_g)),
      sample_count: num(s.sample_count),
    })),
    settings: {
      daily_limit_kg: settingsMap.daily_limit_kg ?? 300,
      intensity_threshold_g_per_kwh: settingsMap.intensity_threshold_g_per_kwh ?? 420,
    },
    recent_lifecycle_events: audit.rows.map((a) => ({
      event_type: a.event_type,
      device_id: a.device_id || a.actor,
    })),
    recent_ai_insights: activeAi.rows.map((a) => ({
      severity: a.severity,
      title: a.title,
      category: a.category,
    })),
  };

  return context;
}

function fingerprint(context) {
  const canonical = JSON.stringify(context); // deterministic enough (single-producer)
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

module.exports = { buildContext, fingerprint };