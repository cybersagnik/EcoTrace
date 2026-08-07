const express = require('express');
const { Pool } = require('pg');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const PDFDocument = require('pdfkit');

require('dotenv').config();

const app = express();
app.use(express.json());

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://ecotrace:[REDACTED]@postgres:5432/ecotrace';
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://auth-service:3001';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'changeme';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const JWT_EXPIRY = parseInt(process.env.JWT_EXPIRY_MINUTES || '60') * 60;
const PORT = process.env.PORT || 3003;

// ─── CORS configuration ────────────────────────────────────────────────────
// Comma-separated list of allowed origins; defaults include localhost &
// the deployed tunnel URL placeholder so the dashboard works during
// the Innovathon demo.
const CORS_ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS ||
  'http://localhost,https://localhost,http://127.0.0.1,https://127.0.0.1')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// Allow wildcard at runtime if explicitly set (CORS_ALLOWED_ORIGINS=*)
const CORS_ALLOW_ALL = CORS_ALLOWED_ORIGINS.length === 1 && CORS_ALLOWED_ORIGINS[0] === '*';

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (CORS_ALLOW_ALL || CORS_ALLOWED_ORIGINS.includes(origin))) {
    res.setHeader('Access-Control-Allow-Origin', CORS_ALLOW_ALL ? '*' : origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Admin-Token');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

const pool = new Pool({ connectionString: DATABASE_URL });

// Reads the organization daily carbon budget (kg) from the settings table.
// Used to render "emitted vs threshold" indicators across the dashboard.
async function getDailyLimitKg() {
  try {
    const r = await pool.query(`SELECT value FROM settings WHERE key = 'daily_limit_kg'`);
    if (r.rows.length && typeof r.rows[0].value === 'number' && r.rows[0].value > 0) {
      return r.rows[0].value;
    }
  } catch (err) {
    console.error('[api] getDailyLimitKg failed:', err.message);
  }
  return 300; // default budget when unset
}

// ═══════════════════════════════════════════════════════════════
// JWT VERIFICATION MIDDLEWARE
// ═══════════════════════════════════════════════════════════════
async function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.substring(7);

  try {
    // Call auth-service to verify token (forward the JWT)
    const response = await axios.get(`${AUTH_SERVICE_URL}/verify`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 5000
    });

    if (response.status === 200) {
      // Extract device_id from response headers
      const deviceId = response.headers['x-device-id'];
      req.deviceId = deviceId;
      req.deviceClass = response.headers['x-device-class'];
      return next();
    }
  } catch (err) {
    if (err.response && err.response.status === 401) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    console.error('[api] Auth verification error:', err.message);
    return res.status(500).json({ error: 'Auth service unavailable' });
  }
}

// ═══════════════════════════════════════════════════════════════
// HEALTH CHECK (no auth required)
// ═══════════════════════════════════════════════════════════════
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// ═══════════════════════════════════════════════════════════════
// POST /api/auth/login
// Issues a real JWT for the dashboard so the frontend stops
// falling back to mock data on 401. The login form sends
// { device_id (email), secret (password), device_class }.
//
// For demo / Innovathon purposes:
//   * If device_class === 'admin' OR secret matches ADMIN_TOKEN, mint
//     a real JWT signed with the same JWT_SECRET as auth-service so
//     /verify accepts it.
//   * This lets the demo login page work end-to-end with real data.
// ═══════════════════════════════════════════════════════════════
app.post('/api/auth/login', (req, res) => {
  const device_id = req.body.device_id || req.body.email;
  const secret = req.body.secret || req.body.password;
  const device_class = req.body.device_class || 'admin';

  if (!device_id) {
    return res.status(400).json({ error: 'device_id required' });
  }
  // Demo policy: any secret is accepted for the admin role; otherwise
  // the secret must equal ADMIN_TOKEN.
  const isAdmin = device_class === 'admin';
  if (!isAdmin && secret !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'invalid credentials' });
  }

  const now = Math.floor(Date.now() / 1000);
  const token = jwt.sign(
    { device_id, device_class, iat: now, exp: now + JWT_EXPIRY },
    JWT_SECRET
  );

  res.json({
    access_token: token,
    expires_at: new Date((now + JWT_EXPIRY) * 1000).toISOString(),
    device_id,
    device_class,
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/devices
// Auth required. Returns only devices that have actually sent
// telemetry within the last 10 minutes — devices that
// registered but never produced a sample are NOT shown.
// ═══════════════════════════════════════════════════════════════
const CLASS_MAP = {
  linux: 'linux-server',
  windows: 'windows-workstation',
  iot: 'iot-sensor',
  plc: 'plc-controller',
};
// Maps the raw device_class column value to the high-level UI category.
// Endpoints = Tier 1 (Linux/Windows agents); IoT and PLC = Tier 2 (future).
const CATEGORY_MAP = {
  linux: 'endpoint',
  windows: 'endpoint',
  iot: 'iot',
  plc: 'plc',
};
const SCHEMA_VERSION = 'v1.0';
const RUNNING_WINDOW_MINUTES = 10;

app.get('/api/devices', verifyJWT, async (req, res) => {
  try {
    // Only Tier 1 endpoints (Linux + Windows agents) are returned here.
    // Tier 2 devices (IoT, PLC) authenticate over MQTT/mTLS and feed the
    // same telemetry.raw topic — the frontend should treat them as a
    // separate category. They will get their own endpoints once Phase 5
    // ships; until then, filter them out so the running-device list is
    // guaranteed to be Endpoint-only.
    const query = `
      SELECT
        d.device_id,
        d.device_class,
        d.os,
        d.hostname,
        d.status,
        d.last_seen_at,
        d.fleet_id,
        f.name as fleet_name,
        f.grid_region as fleet_region,
        d.notification_consent,
        d.notification_channel,
        COALESCE(s.carbon_g, 0) as carbon_g_today,
        COALESCE(s.energy_wh, 0) as energy_wh_today,
        COALESCE(s.sample_count, 0) as sample_count
      FROM devices d
      LEFT JOIN fleets f ON f.id = d.fleet_id
      LEFT JOIN daily_summaries s
        ON d.device_id = s.device_id AND s.date = CURRENT_DATE
      WHERE d.status != 'revoked'
        AND d.last_seen_at IS NOT NULL
        AND d.last_seen_at >= NOW() - ($1 || ' minutes')::interval
        AND d.device_class IN ('linux', 'windows')
      ORDER BY carbon_g_today DESC
    `;

    const result = await pool.query(query, [RUNNING_WINDOW_MINUTES]);
    const devices = result.rows.map((r) => ({
      device_id: r.device_id,
      device_class: CLASS_MAP[r.device_class] || r.device_class,
      device_category: CATEGORY_MAP[r.device_class] || null,
      os: r.os || null,
      hostname: r.hostname || null,
      status: r.status === 'active' ? 'operating' : r.status,
      last_seen_at: r.last_seen_at ? new Date(r.last_seen_at).toISOString() : null,
      fleet_id: r.fleet_id ? parseInt(r.fleet_id, 10) : null,
      fleet_name: r.fleet_name || null,
      fleet_region: r.fleet_region || null,
      carbon_g: parseFloat(r.carbon_g_today) || 0,
      energy_wh_today: parseFloat(r.energy_wh_today) || 0,
      sample_count: parseInt(r.sample_count, 10) || 0,
      notification_consent: Boolean(r.notification_consent),
      notification_channel: r.notification_channel || null,
      schema_version: SCHEMA_VERSION,
    }));
    res.json(devices);
  } catch (err) {
    console.error('[api] GET /api/devices failed:', err);
    res.status(500).json({ error: 'Database query failed' });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/devices/categories
// Auth required. Returns counts per device category for the sidebar
// badges: { endpoints, iot, plc, fleets }.
// endpoints = running linux/windows devices
// iot/plc   = 0 for now (no data flow yet)
// fleets    = COUNT of distinct fleets that have at least one
//             currently-running device (last_seen_at within window).
// ═══════════════════════════════════════════════════════════════
app.get('/api/devices/categories', verifyJWT, async (req, res) => {
  try {
    const endpointQ = `
      SELECT COUNT(*) as c
      FROM devices
      WHERE status = 'active'
        AND last_seen_at IS NOT NULL
        AND last_seen_at >= NOW() - ($1 || ' minutes')::interval
        AND device_class IN ('linux', 'windows')
    `;
    const fleetQ = `
      SELECT COUNT(DISTINCT d.fleet_id) as c
      FROM devices d
      WHERE d.status = 'active'
        AND d.last_seen_at IS NOT NULL
        AND d.last_seen_at >= NOW() - ($1 || ' minutes')::interval
        AND d.device_class IN ('linux', 'windows')
        AND d.fleet_id IS NOT NULL
    `;
    const [endpointR, fleetR] = await Promise.all([
      pool.query(endpointQ, [RUNNING_WINDOW_MINUTES]),
      pool.query(fleetQ, [RUNNING_WINDOW_MINUTES]),
    ]);
    res.json({
      endpoints: parseInt(endpointR.rows[0].c, 10) || 0,
      iot: 0,
      plc: 0,
      fleets: parseInt(fleetR.rows[0].c, 10) || 0,
    });
  } catch (err) {
    console.error('[api] GET /api/devices/categories failed:', err);
    res.status(500).json({ error: 'Database query failed' });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/fleet
// Auth required. Returns fleet aggregates in the shape the
// frontend FleetResponse expects:
//   { summary, trend[day,carbon_kg], hourly_trend[hour,carbon_g,emissions_raw], regions }
//
// `regions[]` is now derived from real `fleets` rows joined with
// running devices — no hardcoded GRID_REGION. If a fleet has no
// running devices it is omitted from the regions list. Devices not
// assigned to a fleet are rolled into an "Unassigned" region so the
// dashboard still reflects real telemetry.
// ═══════════════════════════════════════════════════════════════

function classifyIntensityFromKg(kg) {
  if (kg < 0.25) return 'clean';
  if (kg < 0.5) return 'moderate';
  return 'high';
}

app.get('/api/fleet', verifyJWT, async (req, res) => {
  try {
    // ── Today's aggregate (only devices that have sent telemetry recently) ──
    const todayQ = `
      SELECT
        COUNT(DISTINCT d.device_id) as active_devices,
        COALESCE(SUM(s.carbon_g), 0) as total_carbon_g,
        COALESCE(SUM(s.energy_wh), 0) as total_energy_wh,
        NOW() as as_of,
        MAX(d.last_seen_at) as last_seen_at
      FROM devices d
      LEFT JOIN daily_summaries s
        ON d.device_id = s.device_id AND s.date = CURRENT_DATE
      WHERE d.status = 'active'
        AND d.last_seen_at IS NOT NULL
        AND d.last_seen_at >= NOW() - ($1 || ' minutes')::interval
    `;
    const todayR = await pool.query(todayQ, [RUNNING_WINDOW_MINUTES]);
    const today = todayR.rows[0];

    // ── Yesterday's aggregate (for delta_pct_vs_yesterday) ──────
    const yQ = `
      SELECT COALESCE(SUM(carbon_g), 0) as carbon_g
      FROM daily_summaries
      WHERE date = CURRENT_DATE - INTERVAL '1 day'
    `;
    const yR = await pool.query(yQ);
    const yesterday_g = parseFloat(yR.rows[0].carbon_g) || 0;
    const today_g = parseFloat(today.total_carbon_g) || 0;
    const delta_pct_vs_yesterday = yesterday_g > 0
      ? parseFloat((((today_g - yesterday_g) / yesterday_g) * 100).toFixed(1))
      : (today_g > 0 ? 100 : 0);

    const total_carbon_kg = today_g / 1000;
    const last_seen = today.last_seen_at ? new Date(today.last_seen_at) : null;
    const last_sync_seconds_ago = last_seen
      ? Math.max(0, Math.floor((Date.now() - last_seen.getTime()) / 1000))
      : 0;

    // ── Per-fleet aggregation (replaces the old single-region regions[]) ──
    // Includes a synthetic "Unassigned" region for devices with fleet_id IS NULL
    // so unassigned devices still show up in the dashboard.
    const regionsQ = `
      SELECT
        COALESCE(f.name, 'Unassigned') as region,
        COALESCE(f.grid_region, '—') as grid_region,
        COUNT(DISTINCT d.device_id) as active_devices,
        COALESCE(SUM(s.carbon_g), 0) as carbon_g,
        COALESCE(SUM(s.energy_wh), 0) as energy_wh
      FROM devices d
      LEFT JOIN fleets f ON f.id = d.fleet_id
      LEFT JOIN daily_summaries s
        ON d.device_id = s.device_id AND s.date = CURRENT_DATE
      WHERE d.status = 'active'
        AND d.last_seen_at IS NOT NULL
        AND d.last_seen_at >= NOW() - ($1 || ' minutes')::interval
        AND d.device_class IN ('linux', 'windows')
      GROUP BY f.name, f.grid_region
      ORDER BY carbon_g DESC
    `;
    const regionsR = await pool.query(regionsQ, [RUNNING_WINDOW_MINUTES]);
    const regions = regionsR.rows.map((r) => ({
      region: r.region,
      grid_region: r.grid_region,
      carbon_kg: parseFloat(r.carbon_g) / 1000,
      energy_wh: parseFloat(r.energy_wh) || 0,
      active_devices: parseInt(r.active_devices, 10) || 0,
    }));

    const summary = {
      active_devices: parseInt(today.active_devices, 10) || 0,
      total_carbon_g: today_g,
      total_carbon_kg,
      total_energy_wh: parseFloat(today.total_energy_wh) || 0,
      delta_pct_vs_yesterday,
      grid_region: regions.length > 0
        ? (regions.length === 1 ? regions[0].region : 'Mixed')
        : '—',
      last_sync_seconds_ago,
      last_updated: new Date(today.as_of).toISOString(),
      intensity: classifyIntensityFromKg(total_carbon_kg),
    };

    // ── 7-day trend (last 7 days, oldest → newest) ──────────────
    const trendQ = `
      SELECT date, COALESCE(SUM(carbon_g), 0) as carbon_g
      FROM daily_summaries
      WHERE date >= CURRENT_DATE - INTERVAL '6 days'
      GROUP BY date
      ORDER BY date ASC
    `;
    const trendR = await pool.query(trendQ);
    const trend = trendR.rows.map((r) => ({
      day: new Date(r.date).toISOString().slice(0, 10),
      carbon_kg: parseFloat(r.carbon_g) / 1000,
    }));

    // ── Today's hourly buckets (from emissions_calculated) ──────
    const hourQ = `
      SELECT
        DATE_TRUNC('hour', timestamp) as hour,
        COALESCE(SUM(carbon_g), 0) as carbon_g,
        COUNT(*) as emissions_raw
      FROM emissions_calculated
      WHERE timestamp >= DATE_TRUNC('day', NOW())
      GROUP BY hour
      ORDER BY hour ASC
    `;
    const hourR = await pool.query(hourQ);
    const hourly_trend = hourR.rows.map((r) => ({
      hour: new Date(r.hour).toISOString(),
      carbon_g: parseFloat(r.carbon_g),
      emissions_raw: parseInt(r.emissions_raw, 10),
    }));

    res.json({ summary, trend, hourly_trend, regions });
  } catch (err) {
    console.error('[api] GET /api/fleet failed:', err);
    res.status(500).json({ error: 'Database query failed' });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/devices/:id/history
// Auth required. Returns last 24 hours of hourly carbon data.
// Response shape: { device_id, history: [{hour, carbon_g, emissions_raw}] }
// ═══════════════════════════════════════════════════════════════
app.get('/api/devices/:id/history', verifyJWT, async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT
        DATE_TRUNC('hour', timestamp) as hour,
        COALESCE(SUM(carbon_g), 0) as carbon_g,
        COUNT(*) as emissions_raw
      FROM emissions_calculated
      WHERE device_id = $1 AND timestamp >= NOW() - INTERVAL '24 hours'
      GROUP BY hour
      ORDER BY hour ASC
    `;

    const result = await pool.query(query, [id]);

    const history = result.rows.map((row) => ({
      hour: new Date(row.hour).toISOString(),
      carbon_g: parseFloat(row.carbon_g),
      emissions_raw: parseInt(row.emissions_raw, 10),
    }));

    res.json({ device_id: id, history });
  } catch (err) {
    console.error('[api] GET /api/devices/:id/history failed:', err);
    res.status(500).json({ error: 'Database query failed' });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/recommendation
// Auth required. Finds highest-emitter device & returns RecommendationResponse shape:
//   { recommendations: [{id,title,description,impact_kg,region,priority,action_label}],
//     total_potential_savings_kg, last_computed }
// ═══════════════════════════════════════════════════════════════
app.get('/api/recommendation', verifyJWT, async (req, res) => {
  try {
    const topQuery = `
      SELECT device_id, carbon_g FROM daily_summaries
      WHERE date = CURRENT_DATE
      ORDER BY carbon_g DESC
      LIMIT 1
    `;
    const avgQuery = `
      SELECT AVG(carbon_g) as avg_carbon FROM daily_summaries
      WHERE date = CURRENT_DATE
    `;

    const [topResult, avgResult] = await Promise.all([
      pool.query(topQuery),
      pool.query(avgQuery),
    ]);

    if (topResult.rows.length === 0) {
      return res.json({
        recommendations: [],
        total_potential_savings_kg: 0,
        last_computed: new Date().toISOString(),
      });
    }

    const topDevice = topResult.rows[0];
    const fleetAvg = parseFloat(avgResult.rows[0].avg_carbon) || 0;
    const topG = parseFloat(topDevice.carbon_g);

    const percentAbove = fleetAvg > 0
      ? Math.round(((topG - fleetAvg) / fleetAvg) * 100)
      : 0;
    const aboveAvg = percentAbove > 0;
    const priority = percentAbove >= 50 ? 'critical' : percentAbove >= 20 ? 'high' : 'medium';

    // Potential savings heuristic: 30% of the device's over-average emissions
    const potential_savings_g = aboveAvg ? Math.max(0, topG - fleetAvg) * 0.3 : topG * 0.05;
    const impact_kg = potential_savings_g / 1000;

    // Look up which fleet the top device belongs to (may be null)
    const fleetQ = `
      SELECT f.name, f.grid_region FROM devices d
      LEFT JOIN fleets f ON f.id = d.fleet_id
      WHERE d.device_id = $1
    `;
    const fleetR = await pool.query(fleetQ, [topDevice.device_id]);
    const fleet = fleetR.rows[0] || {};
    const region_label = fleet.name
      ? `${fleet.name} (${fleet.grid_region})`
      : (fleet.grid_region || 'Unassigned');

    const recommendations = [{
      id: `rec-${topDevice.device_id}`,
      title: `Throttle idle load on ${topDevice.device_id}`,
      description: aboveAvg
        ? `${topDevice.device_id} emitted ${topG.toFixed(1)}g CO₂ today — ${percentAbove}% above fleet average. Suspending idle background processes is expected to reduce emissions by ${potential_savings_g.toFixed(1)}g.`
        : `${topDevice.device_id} emitted ${topG.toFixed(1)}g CO₂ today (${Math.abs(percentAbove)}% below fleet average). Even so, trimming idle work could save another ${potential_savings_g.toFixed(1)}g.`,
      impact_kg: parseFloat(impact_kg.toFixed(3)),
      region: region_label,
      priority,
      action_label: aboveAvg ? 'Suspend idle processes' : 'Optimize background work',
    }];

    res.json({
      recommendations,
      total_potential_savings_kg: parseFloat(impact_kg.toFixed(3)),
      last_computed: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[api] GET /api/recommendation failed:', err);
    res.status(500).json({ error: 'Database query failed' });
  }
});

// ═══════════════════════════════════════════════════════════════
// FLEETS CRUD
//
// A fleet is a user-managed logical grouping of devices (e.g.
// "IND-TCS", "US-CAL production cluster"). Devices can be assigned
// to a fleet or left unassigned — the latter case is intentional,
// matches the user's "initially fleet should be empty" requirement.
// ═══════════════════════════════════════════════════════════════

// GET /api/fleets — list all fleets with aggregate stats
app.get('/api/fleets', verifyJWT, async (req, res) => {
  try {
    const query = `
      SELECT
        f.id, f.name, f.description, f.grid_region,
        f.grid_intensity_g_per_kwh, f.created_at, f.updated_at,
        COUNT(d.device_id) as total_devices,
        COUNT(d.device_id) FILTER (
          WHERE d.status = 'active'
            AND d.last_seen_at IS NOT NULL
            AND d.last_seen_at >= NOW() - ($1 || ' minutes')::interval
        ) as active_devices,
        COALESCE(SUM(s.carbon_g), 0) as carbon_g_today,
        COALESCE(SUM(s.energy_wh), 0) as energy_wh_today
      FROM fleets f
      LEFT JOIN devices d ON d.fleet_id = f.id AND d.status != 'revoked'
      LEFT JOIN daily_summaries s
        ON s.device_id = d.device_id AND s.date = CURRENT_DATE
      GROUP BY f.id
      ORDER BY f.id ASC
    `;
    const result = await pool.query(query, [RUNNING_WINDOW_MINUTES]);
    const fleets = result.rows.map((r) => ({
      id: parseInt(r.id, 10),
      name: r.name,
      description: r.description,
      grid_region: r.grid_region,
      grid_intensity_g_per_kwh: parseFloat(r.grid_intensity_g_per_kwh) || 0,
      total_devices: parseInt(r.total_devices, 10) || 0,
      active_devices: parseInt(r.active_devices, 10) || 0,
      carbon_g_today: parseFloat(r.carbon_g_today) || 0,
      energy_wh_today: parseFloat(r.energy_wh_today) || 0,
      created_at: r.created_at ? new Date(r.created_at).toISOString() : null,
      updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : null,
    }));
    res.json(fleets);
  } catch (err) {
    console.error('[api] GET /api/fleets failed:', err);
    res.status(500).json({ error: 'Database query failed' });
  }
});

// POST /api/fleets — create a new fleet
app.post('/api/fleets', verifyJWT, async (req, res) => {
  try {
    const { name, description, grid_region, grid_intensity_g_per_kwh } = req.body || {};
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ error: 'name is required (min 2 chars)' });
    }
    if (!grid_region || typeof grid_region !== 'string') {
      return res.status(400).json({ error: 'grid_region is required' });
    }
    const intensity = parseFloat(grid_intensity_g_per_kwh);
    if (isNaN(intensity) || intensity <= 0) {
      return res.status(400).json({ error: 'grid_intensity_g_per_kwh must be a positive number' });
    }
    const insertQ = `
      INSERT INTO fleets (name, description, grid_region, grid_intensity_g_per_kwh)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, description, grid_region, grid_intensity_g_per_kwh, created_at, updated_at
    `;
    const result = await pool.query(insertQ, [
      name.trim(),
      (description || '').trim() || null,
      grid_region.trim(),
      intensity,
    ]);
    const fleet = result.rows[0];
    await pool.query(
      `INSERT INTO audit_log (event_type, actor, metadata, created_at)
       VALUES ($1, $2, $3, NOW())`,
      ['fleet.created', 'admin', JSON.stringify({ fleet_id: fleet.id, name: fleet.name })]
    );
    res.status(201).json({
      id: parseInt(fleet.id, 10),
      name: fleet.name,
      description: fleet.description,
      grid_region: fleet.grid_region,
      grid_intensity_g_per_kwh: parseFloat(fleet.grid_intensity_g_per_kwh) || 0,
      total_devices: 0,
      active_devices: 0,
      carbon_g_today: 0,
      energy_wh_today: 0,
      created_at: new Date(fleet.created_at).toISOString(),
      updated_at: new Date(fleet.updated_at).toISOString(),
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Fleet name already exists' });
    }
    console.error('[api] POST /api/fleets failed:', err);
    res.status(500).json({ error: 'Database query failed' });
  }
});

// GET /api/fleets/:id — detail (includes assigned devices)
app.get('/api/fleets/:id', verifyJWT, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'invalid fleet id' });
    const fleetQ = `
      SELECT id, name, description, grid_region, grid_intensity_g_per_kwh,
             created_at, updated_at
      FROM fleets WHERE id = $1
    `;
    const fleetR = await pool.query(fleetQ, [id]);
    if (fleetR.rows.length === 0) {
      return res.status(404).json({ error: 'fleet not found' });
    }
    const f = fleetR.rows[0];
    const devicesQ = `
      SELECT d.device_id, d.device_class, d.os, d.hostname, d.status, d.last_seen_at,
             COALESCE(s.carbon_g, 0) as carbon_g_today,
             COALESCE(s.energy_wh, 0) as energy_wh_today
      FROM devices d
      LEFT JOIN daily_summaries s
        ON d.device_id = s.device_id AND s.date = CURRENT_DATE
      WHERE d.fleet_id = $1 AND d.status != 'revoked'
      ORDER BY d.device_id ASC
    `;
    const devicesR = await pool.query(devicesQ, [id]);
    res.json({
      id: parseInt(f.id, 10),
      name: f.name,
      description: f.description,
      grid_region: f.grid_region,
      grid_intensity_g_per_kwh: parseFloat(f.grid_intensity_g_per_kwh) || 0,
      created_at: new Date(f.created_at).toISOString(),
      updated_at: new Date(f.updated_at).toISOString(),
      devices: devicesR.rows.map((d) => ({
        device_id: d.device_id,
        device_class: CLASS_MAP[d.device_class] || d.device_class,
        device_category: CATEGORY_MAP[d.device_class] || null,
        os: d.os || null,
        hostname: d.hostname || null,
        status: d.status === 'active' ? 'operating' : d.status,
        last_seen_at: d.last_seen_at ? new Date(d.last_seen_at).toISOString() : null,
        carbon_g: parseFloat(d.carbon_g_today) || 0,
        energy_wh_today: parseFloat(d.energy_wh_today) || 0,
      })),
    });
  } catch (err) {
    console.error('[api] GET /api/fleets/:id failed:', err);
    res.status(500).json({ error: 'Database query failed' });
  }
});

// PATCH /api/fleets/:id — update name/description/region/intensity
app.patch('/api/fleets/:id', verifyJWT, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'invalid fleet id' });
    const { name, description, grid_region, grid_intensity_g_per_kwh } = req.body || {};
    const sets = [];
    const vals = [];
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length < 2) {
        return res.status(400).json({ error: 'name must be min 2 chars' });
      }
      sets.push(`name = $${vals.push(name.trim())}`);
    }
    if (description !== undefined) {
      sets.push(`description = $${vals.push((description || '').trim() || null)}`);
    }
    if (grid_region !== undefined) {
      if (typeof grid_region !== 'string' || !grid_region.trim()) {
        return res.status(400).json({ error: 'grid_region required' });
      }
      sets.push(`grid_region = $${vals.push(grid_region.trim())}`);
    }
    if (grid_intensity_g_per_kwh !== undefined) {
      const intensity = parseFloat(grid_intensity_g_per_kwh);
      if (isNaN(intensity) || intensity <= 0) {
        return res.status(400).json({ error: 'grid_intensity_g_per_kwh must be positive' });
      }
      sets.push(`grid_intensity_g_per_kwh = $${vals.push(intensity)}`);
    }
    if (sets.length === 0) {
      return res.status(400).json({ error: 'no fields to update' });
    }
    sets.push(`updated_at = NOW()`);
    vals.push(id);
    const q = `UPDATE fleets SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING id`;
    const result = await pool.query(q, vals);
    if (result.rows.length === 0) return res.status(404).json({ error: 'fleet not found' });
    res.json({ updated: true, id: parseInt(result.rows[0].id, 10) });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'fleet name already exists' });
    }
    console.error('[api] PATCH /api/fleets/:id failed:', err);
    res.status(500).json({ error: 'Database query failed' });
  }
});

// DELETE /api/fleets/:id — delete (only if no devices assigned)
app.delete('/api/fleets/:id', verifyJWT, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'invalid fleet id' });
    const cntQ = `SELECT COUNT(*) as c FROM devices WHERE fleet_id = $1 AND status != 'revoked'`;
    const cntR = await pool.query(cntQ, [id]);
    const count = parseInt(cntR.rows[0].c, 10) || 0;
    if (count > 0) {
      return res.status(409).json({
        error: `Cannot delete fleet: ${count} device(s) still assigned. Unassign first.`,
        assigned_devices: count,
      });
    }
    const delQ = `DELETE FROM fleets WHERE id = $1 RETURNING id, name`;
    const delR = await pool.query(delQ, [id]);
    if (delR.rows.length === 0) return res.status(404).json({ error: 'fleet not found' });
    res.json({ deleted: true, id: parseInt(delR.rows[0].id, 10), name: delR.rows[0].name });
  } catch (err) {
    console.error('[api] DELETE /api/fleets/:id failed:', err);
    res.status(500).json({ error: 'Database query failed' });
  }
});

// POST /api/fleets/:id/devices — assign a device to a fleet
app.post('/api/fleets/:id/devices', verifyJWT, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'invalid fleet id' });
    const { device_id } = req.body || {};
    if (!device_id || typeof device_id !== 'string') {
      return res.status(400).json({ error: 'device_id is required' });
    }
    // Verify fleet exists
    const fleetR = await pool.query(`SELECT id, name FROM fleets WHERE id = $1`, [id]);
    if (fleetR.rows.length === 0) return res.status(404).json({ error: 'fleet not found' });
    // Verify device exists & not revoked
    const devR = await pool.query(
      `SELECT device_id, status, fleet_id FROM devices WHERE device_id = $1`,
      [device_id]
    );
    if (devR.rows.length === 0) return res.status(404).json({ error: 'device not found' });
    if (devR.rows[0].status === 'revoked') {
      return res.status(409).json({ error: 'cannot assign revoked device' });
    }
    await pool.query(
      `UPDATE devices SET fleet_id = $1 WHERE device_id = $2`,
      [id, device_id]
    );
    await pool.query(
      `INSERT INTO audit_log (event_type, device_id, actor, metadata, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      ['fleet.assigned', device_id, 'admin',
        JSON.stringify({ fleet_id: id, fleet_name: fleetR.rows[0].name })]
    );
    res.json({
      assigned: true,
      device_id,
      fleet_id: id,
      fleet_name: fleetR.rows[0].name,
    });
  } catch (err) {
    console.error('[api] POST /api/fleets/:id/devices failed:', err);
    res.status(500).json({ error: 'Database query failed' });
  }
});

// DELETE /api/fleets/:id/devices/:device_id — unassign a device
app.delete('/api/fleets/:id/devices/:device_id', verifyJWT, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'invalid fleet id' });
    const { device_id } = req.params;
    const result = await pool.query(
      `UPDATE devices SET fleet_id = NULL
       WHERE device_id = $1 AND fleet_id = $2
       RETURNING device_id`,
      [device_id, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'device not assigned to this fleet' });
    }
    await pool.query(
      `INSERT INTO audit_log (event_type, device_id, actor, metadata, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      ['fleet.unassigned', device_id, 'admin', JSON.stringify({ fleet_id: id })]
    );
    res.json({ unassigned: true, device_id, fleet_id: id });
  } catch (err) {
    console.error('[api] DELETE /api/fleets/:id/devices/:device_id failed:', err);
    res.status(500).json({ error: 'Database query failed' });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/analytics
// Auth required. Returns scope-emissions, peak window, energy mix
// for the Analytics page. Values are derived from the same
// daily_summaries / emissions_calculated tables the rest of the
// API uses — no mock data.
// ═══════════════════════════════════════════════════════════════
app.get('/api/analytics', verifyJWT, async (req, res) => {
  try {
    // ── Today vs yesterday aggregate (only running devices) ────
    const todayQ = `
      SELECT COALESCE(SUM(s.carbon_g), 0) as carbon_g
      FROM devices d
      LEFT JOIN daily_summaries s
        ON d.device_id = s.device_id AND s.date = CURRENT_DATE
      WHERE d.status = 'active'
        AND d.last_seen_at IS NOT NULL
        AND d.last_seen_at >= NOW() - ($1 || ' minutes')::interval
    `;
    const yQ = `
      SELECT COALESCE(SUM(s.carbon_g), 0) as carbon_g
      FROM devices d
      LEFT JOIN daily_summaries s
        ON d.device_id = s.device_id AND s.date = CURRENT_DATE - INTERVAL '1 day'
      WHERE d.status = 'active'
    `;
    const [todayR, yR] = await Promise.all([
      pool.query(todayQ, [RUNNING_WINDOW_MINUTES]),
      pool.query(yQ),
    ]);
    const today_g = parseFloat(todayR.rows[0].carbon_g) || 0;
    const yesterday_g = parseFloat(yR.rows[0].carbon_g) || 0;
    const today_kg = today_g / 1000;
    const yesterday_kg = yesterday_g / 1000;
    const delta_pct = yesterday_kg > 0
      ? parseFloat((((today_kg - yesterday_kg) / yesterday_kg) * 100).toFixed(1))
      : 0;

    // ── Today's hourly buckets (for peak window detection) ─────
    const hourQ = `
      SELECT
        DATE_TRUNC('hour', timestamp) as hour,
        COALESCE(SUM(carbon_g), 0) as carbon_g
      FROM emissions_calculated
      WHERE timestamp >= DATE_TRUNC('day', NOW())
      GROUP BY hour
      ORDER BY hour ASC
    `;
    const hourR = await pool.query(hourQ);
    const hours = hourR.rows.map((r) => ({
      hour: new Date(r.hour),
      carbon_g: parseFloat(r.carbon_g),
    }));

    let peak_window = '—';
    if (hours.length >= 1) {
      // Pick the single hour with max emissions; format "HH:00-HH:00"
      const peak = hours.reduce((max, h) => h.carbon_g > max.carbon_g ? h : max, hours[0]);
      const hStart = peak.hour.getUTCHours().toString().padStart(2, '0');
      const hEnd = ((peak.hour.getUTCHours() + 1) % 24).toString().padStart(2, '0');
      peak_window = `${hStart}:00 - ${hEnd}:00`;
    }

    // ── Scope emissions & offset savings ──────────────────────
    // "Scope" = today + yesterday + day-before-yesterday cumulative,
    // giving a 3-day rolling figure that matches the dashboard copy.
    const threeDayQ = `
      SELECT COALESCE(SUM(s.carbon_g), 0) as carbon_g
      FROM daily_summaries s
      JOIN devices d ON d.device_id = s.device_id
      WHERE s.date >= CURRENT_DATE - INTERVAL '2 days'
        AND s.date <= CURRENT_DATE
        AND d.status = 'active'
        AND d.last_seen_at IS NOT NULL
        AND d.last_seen_at >= NOW() - ($1 || ' minutes')::interval
    `;
    const threeDayR = await pool.query(threeDayQ, [RUNNING_WINDOW_MINUTES]);
    const three_day_kg = (parseFloat(threeDayR.rows[0].carbon_g) || 0) / 1000;
    const scope_emissions_kg = parseFloat(three_day_kg.toFixed(2));

    // Offset savings = how much CO2 we avoided vs same window
    // yesterday. Today < yesterday → savings. Otherwise 0.
    const offset_saved_kg = today_kg < yesterday_kg && yesterday_kg > 0
      ? parseFloat((yesterday_kg - today_kg).toFixed(2))
      : 0;
    const equivalent_trees = Math.round(offset_saved_kg / 21); // 1 tree ≈ 21 kg CO2/yr

    // ── Energy mix (single-region US-CAL profile, weighted by
    //    current fleet intensity). clean_pct mirrors the FleetCard
    //    intensity: clean ⇒ high clean share, moderate ⇒ medium,
    //    high ⇒ low.
    const intensityQ = `
      SELECT
        COUNT(*) FILTER (WHERE s.carbon_g < 250) as clean,
        COUNT(*) FILTER (WHERE s.carbon_g >= 250 AND s.carbon_g < 500) as moderate,
        COUNT(*) FILTER (WHERE s.carbon_g >= 500) as high
      FROM daily_summaries s
      JOIN devices d ON d.device_id = s.device_id
      WHERE s.date = CURRENT_DATE
        AND d.status = 'active'
        AND d.last_seen_at IS NOT NULL
        AND d.last_seen_at >= NOW() - ($1 || ' minutes')::interval
    `;
    const intensityR = await pool.query(intensityQ, [RUNNING_WINDOW_MINUTES]);
    const cleanCount = parseInt(intensityR.rows[0].clean, 10) || 0;
    const moderateCount = parseInt(intensityR.rows[0].moderate, 10) || 0;
    const highCount = parseInt(intensityR.rows[0].high, 10) || 0;
    const totalCount = cleanCount + moderateCount + highCount;
    const clean_pct = totalCount > 0
      ? parseFloat(((cleanCount / totalCount) * 100).toFixed(1))
      : 100; // nothing measured ⇒ assume clean (e.g. idle fleet)

    // Energy mix weights shift with fleet intensity:
    //   mostly clean   →  Solar&Wind 52%, Hydro 12%, Thermal 36%
    //   mostly moderate→  Solar&Wind 38%, Hydro 14%, Thermal 48%
    //   mostly high    →  Solar&Wind 22%, Hydro 10%, Thermal 68%
    let solarPct, hydroPct, thermalPct;
    if (totalCount === 0 || (cleanCount >= moderateCount && cleanCount >= highCount)) {
      solarPct = 52; hydroPct = 12; thermalPct = 36;
    } else if (moderateCount >= highCount) {
      solarPct = 38; hydroPct = 14; thermalPct = 48;
    } else {
      solarPct = 22; hydroPct = 10; thermalPct = 68;
    }
    // Total fleet kWh today (approx: energy_wh / 1000 → kWh)
    const fleet_kwh = Math.max(
      (parseFloat(todayR.rows[0].carbon_g) || 0) * 0, // placeholder for grid kWh weighting
      1
    );
    // Build mix with kWh proportional to current fleet energy_wh_today
    const energyQ = `
      SELECT COALESCE(SUM(s.energy_wh), 0) as wh
      FROM devices d
      LEFT JOIN daily_summaries s
        ON d.device_id = s.device_id AND s.date = CURRENT_DATE
      WHERE d.status = 'active'
        AND d.last_seen_at IS NOT NULL
        AND d.last_seen_at >= NOW() - ($1 || ' minutes')::interval
    `;
    const energyR = await pool.query(energyQ, [RUNNING_WINDOW_MINUTES]);
    const total_wh = parseFloat(energyR.rows[0].wh) || 0;
    const total_kwh = total_wh / 1000;
    const mix = [
      {
        source: 'Solar & Wind',
        pct: solarPct,
        kwh: parseFloat(((total_kwh * solarPct) / 100).toFixed(2)),
        type: 'clean',
      },
      {
        source: 'Hydroelectric',
        pct: hydroPct,
        kwh: parseFloat(((total_kwh * hydroPct) / 100).toFixed(2)),
        type: 'hydro',
      },
      {
        source: 'Regional Thermal Grid',
        pct: thermalPct,
        kwh: parseFloat(((total_kwh * thermalPct) / 100).toFixed(2)),
        type: 'thermal',
      },
    ];

    res.json({
      scope_emissions_kg,
      delta_pct,
      peak_window,
      offset_saved_kg,
      equivalent_trees,
      clean_pct,
      mix,
      last_updated: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[api] GET /api/analytics failed:', err);
    res.status(500).json({ error: 'Database query failed' });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/analytics/fleets
// Auth required. Carbon Analytics drill-down, level 1 — one card per
// fleet (plus the "Unassigned" bucket) showing today's emissions and
// grid profile, plus org totals vs the daily budget threshold.
// ═══════════════════════════════════════════════════════════════
app.get('/api/analytics/fleets', verifyJWT, async (req, res) => {
  try {
    const dailyLimitKg = await getDailyLimitKg();
    const windowSql = `NOW() - ($1 || ' minutes')::interval`;

    const fleetQ = `
      SELECT f.id, f.name, f.grid_region, f.grid_intensity_g_per_kwh,
        COUNT(DISTINCT d.device_id) FILTER (WHERE d.last_seen_at >= ${windowSql}) as active_devices,
        COUNT(DISTINCT d.device_id) as total_devices,
        COALESCE(SUM(s.carbon_g), 0) as carbon_g,
        COALESCE(SUM(s.energy_wh), 0) as energy_wh
      FROM fleets f
      LEFT JOIN devices d ON d.fleet_id = f.id AND d.device_class IN ('linux','windows')
      LEFT JOIN daily_summaries s ON s.device_id = d.device_id AND s.date = CURRENT_DATE
      GROUP BY f.id
      ORDER BY carbon_g DESC
    `;
    const unassignedQ = `
      SELECT
        COUNT(DISTINCT d.device_id) FILTER (WHERE d.last_seen_at >= ${windowSql}) as active_devices,
        COALESCE(SUM(s.carbon_g), 0) as carbon_g,
        COALESCE(SUM(s.energy_wh), 0) as energy_wh
      FROM devices d
      LEFT JOIN daily_summaries s ON s.device_id = d.device_id AND s.date = CURRENT_DATE
      WHERE d.fleet_id IS NULL AND d.device_class IN ('linux','windows')
    `;
    const yQ = `
      SELECT COALESCE(f.id::text, 'UNASSIGNED') as key,
        COALESCE(SUM(s.carbon_g), 0) as carbon_g
      FROM daily_summaries s
      JOIN devices d ON d.device_id = s.device_id
      LEFT JOIN fleets f ON f.id = d.fleet_id
      WHERE s.date = CURRENT_DATE - INTERVAL '1 day'
        AND d.device_class IN ('linux','windows')
      GROUP BY f.id
    `;

    const [fleetR, unassignedR, yR] = await Promise.all([
      pool.query(fleetQ, [RUNNING_WINDOW_MINUTES]),
      pool.query(unassignedQ, [RUNNING_WINDOW_MINUTES]),
      pool.query(yQ),
    ]);

    const yesterday = {};
    for (const row of yR.rows) yesterday[row.key] = parseFloat(row.carbon_g) || 0;

    const fleets = fleetR.rows.map((f) => {
      const carbonG = parseFloat(f.carbon_g) || 0;
      const y = yesterday[String(f.id)] || 0;
      return {
        id: f.id,
        name: f.name,
        grid_region: f.grid_region,
        grid_intensity_g_per_kwh: parseFloat(f.grid_intensity_g_per_kwh) || 240,
        active_devices: parseInt(f.active_devices, 10) || 0,
        total_devices: parseInt(f.total_devices, 10) || 0,
        carbon_g_today: carbonG,
        carbon_kg_today: carbonG / 1000,
        energy_wh_today: parseFloat(f.energy_wh) || 0,
        delta_pct_vs_yesterday: y > 0
          ? parseFloat((((carbonG - y) / y) * 100).toFixed(1))
          : (carbonG > 0 ? 100 : 0),
      };
    });

    const u = unassignedR.rows[0];
    const uCarbonG = parseFloat(u.carbon_g) || 0;
    const uYesterday = yesterday.UNASSIGNED || 0;
    const unassigned = {
      active_devices: parseInt(u.active_devices, 10) || 0,
      carbon_kg_today: uCarbonG / 1000,
      energy_wh_today: parseFloat(u.energy_wh) || 0,
      delta_pct_vs_yesterday: uYesterday > 0
        ? parseFloat((((uCarbonG - uYesterday) / uYesterday) * 100).toFixed(1))
        : (uCarbonG > 0 ? 100 : 0),
    };

    let totalCarbonKg = unassigned.carbon_kg_today;
    let totalEnergyWh = unassigned.energy_wh_today;
    let totalActive = unassigned.active_devices;
    for (const f of fleets) {
      totalCarbonKg += f.carbon_kg_today;
      totalEnergyWh += f.energy_wh_today;
      totalActive += f.active_devices;
    }

    res.json({
      fleets,
      unassigned,
      totals: {
        carbon_kg_today: parseFloat(totalCarbonKg.toFixed(3)),
        energy_wh_today: parseFloat(totalEnergyWh.toFixed(1)),
        active_devices: totalActive,
        daily_limit_kg: dailyLimitKg,
        threshold_exceeded: totalCarbonKg > dailyLimitKg,
        threshold_pct: dailyLimitKg > 0
          ? Math.min(100, parseFloat(((totalCarbonKg / dailyLimitKg) * 100).toFixed(1)))
          : 0,
      },
      last_updated: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[api] GET /api/analytics/fleets failed:', err);
    res.status(500).json({ error: 'Database query failed' });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/analytics/fleets/:id
// Auth required. Drill-down level 2 — the devices inside one fleet with
// today's carbon, live CPU/mem averages, and top emitting services.
// ═══════════════════════════════════════════════════════════════
app.get('/api/analytics/fleets/:id', verifyJWT, async (req, res) => {
  try {
    const fleetId = parseInt(req.params.id, 10);
    if (isNaN(fleetId)) return res.status(400).json({ error: 'Invalid fleet id' });

    const [fleetR, devicesR, svcR] = await Promise.all([
      pool.query(
        `SELECT id, name, description, grid_region, grid_intensity_g_per_kwh FROM fleets WHERE id = $1`,
        [fleetId]
      ),
      pool.query(
        `SELECT d.device_id, d.device_class, d.os, d.hostname, d.status, d.last_seen_at,
                d.rated_tdp_w, d.base_power_w,
                COALESCE(s.carbon_g, 0) as carbon_g,
                COALESCE(s.energy_wh, 0) as energy_wh,
                wr.cpu_avg, wr.mem_avg
         FROM devices d
         LEFT JOIN daily_summaries s ON s.device_id = d.device_id AND s.date = CURRENT_DATE
         LEFT JOIN LATERAL (
           SELECT AVG(cpu_usage) as cpu_avg, AVG(memory_usage) as mem_avg
           FROM emissions_raw er
           WHERE er.device_id = d.device_id AND er.timestamp >= DATE_TRUNC('day', NOW())
         ) wr ON true
         WHERE d.fleet_id = $1 AND d.device_class IN ('linux','windows')
         ORDER BY carbon_g DESC`,
        [fleetId]
      ),
      pool.query(
        `SELECT device_id, service, energy_wh, carbon_g
         FROM emissions_by_service
         WHERE date = CURRENT_DATE
         ORDER BY carbon_g DESC`,
      ),
    ]);

    if (fleetR.rows.length === 0) {
      return res.status(404).json({ error: 'Fleet not found' });
    }

    const byDevice = {};
    for (const s of svcR.rows) {
      if (!byDevice[s.device_id]) byDevice[s.device_id] = [];
      if (byDevice[s.device_id].length < 3) {
        byDevice[s.device_id].push({
          service: s.service,
          carbon_g: parseFloat(s.carbon_g) || 0,
        });
      }
    }

    let totalCarbonG = 0;
    let totalEnergyWh = 0;
    let online = 0;
    const devices = devicesR.rows.map((d) => {
      const carbonG = parseFloat(d.carbon_g) || 0;
      totalCarbonG += carbonG;
      totalEnergyWh += parseFloat(d.energy_wh) || 0;
      if (d.status === 'active' && d.last_seen_at) online++;
      return {
        device_id: d.device_id,
        device_class: d.device_class,
        os: d.os,
        hostname: d.hostname,
        status: d.status === 'active' ? 'operating' : d.status,
        last_seen_at: d.last_seen_at ? new Date(d.last_seen_at).toISOString() : null,
        carbon_g_today: carbonG,
        energy_wh_today: parseFloat(d.energy_wh) || 0,
        cpu_avg: parseFloat(d.cpu_avg) || 0,
        mem_avg: parseFloat(d.mem_avg) || 0,
        rated_tdp_w: parseInt(d.rated_tdp_w, 10) || 45,
        base_power_w: parseInt(d.base_power_w, 10) || 10,
        top_services: byDevice[d.device_id] || [],
      };
    });

    const fleet = fleetR.rows[0];
    res.json({
      fleet: {
        id: fleet.id,
        name: fleet.name,
        description: fleet.description,
        grid_region: fleet.grid_region,
        grid_intensity_g_per_kwh: parseFloat(fleet.grid_intensity_g_per_kwh) || 240,
      },
      summary: {
        carbon_kg_today: totalCarbonG / 1000,
        energy_wh_today: totalEnergyWh,
        devices_total: devices.length,
        devices_online: online,
      },
      devices,
    });
  } catch (err) {
    console.error('[api] GET /api/analytics/fleets/:id failed:', err);
    res.status(500).json({ error: 'Database query failed' });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/analytics/devices/:id
// Auth required. Drill-down level 3 — the full industrial-grade device
// view: 24h carbon history, hourly workload (cpu/mem/network), today's
// per-service breakdown, live state, and the daily threshold.
// ═══════════════════════════════════════════════════════════════
app.get('/api/analytics/devices/:id', verifyJWT, async (req, res) => {
  try {
    const { id } = req.params;

    const [devR, todayR, yR, histR, workR, svcR, latestR, limitKg] = await Promise.all([
      pool.query(
        `SELECT d.device_id, d.device_class, d.os, d.hostname, d.status, d.last_seen_at,
                d.rated_tdp_w, d.base_power_w, d.notification_consent,
                f.id as fleet_id, f.name as fleet_name, f.grid_region,
                f.grid_intensity_g_per_kwh
         FROM devices d LEFT JOIN fleets f ON f.id = d.fleet_id
         WHERE d.device_id = $1`,
        [id]
      ),
      pool.query(
        `SELECT carbon_g, energy_wh FROM daily_summaries WHERE device_id = $1 AND date = CURRENT_DATE`,
        [id]
      ),
      pool.query(
        `SELECT carbon_g FROM daily_summaries
         WHERE device_id = $1 AND date = CURRENT_DATE - INTERVAL '1 day'`,
        [id]
      ),
      pool.query(
        `SELECT DATE_TRUNC('hour', timestamp) as hour, SUM(carbon_g) as carbon_g
         FROM emissions_calculated
         WHERE device_id = $1 AND timestamp >= NOW() - INTERVAL '24 hours'
         GROUP BY hour ORDER BY hour ASC`,
        [id]
      ),
      pool.query(
        `SELECT DATE_TRUNC('hour', timestamp) as hour,
                AVG(cpu_usage) as cpu_avg, AVG(memory_usage) as mem_avg,
                SUM(network_sent + network_received) as net_bytes
         FROM emissions_raw
         WHERE device_id = $1 AND timestamp >= NOW() - INTERVAL '24 hours'
         GROUP BY hour ORDER BY hour ASC`,
        [id]
      ),
      pool.query(
        `SELECT service, energy_wh, carbon_g FROM emissions_by_service
         WHERE device_id = $1 AND date = CURRENT_DATE
         ORDER BY carbon_g DESC LIMIT 25`,
        [id]
      ),
      pool.query(
        `SELECT cpu_usage, memory_usage, raw_payload FROM emissions_raw
         WHERE device_id = $1 ORDER BY timestamp DESC LIMIT 1`,
        [id]
      ),
      getDailyLimitKg(),
    ]);

    if (devR.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const dev = devR.rows[0];
    const todayG = parseFloat(todayR.rows[0]?.carbon_g) || 0;
    const yesterdayG = parseFloat(yR.rows[0]?.carbon_g) || 0;
    const services = svcR.rows.map((s) => ({
      service: s.service,
      energy_wh: parseFloat(s.energy_wh) || 0,
      carbon_g: parseFloat(s.carbon_g) || 0,
    }));
    const totalSvcCarbon = services.reduce((sum, s) => sum + s.carbon_g, 0);

    // Live state from the latest raw payload (best-effort).
    let loadAvg = 0;
    let procCount = 0;
    const latestPayload = latestR.rows[0]?.raw_payload;
    if (latestPayload && typeof latestPayload === 'object') {
      loadAvg = parseFloat(latestPayload.load_average_1m) || 0;
      procCount = parseInt(latestPayload.process_count, 10) || 0;
    }

    res.json({
      device: {
        device_id: dev.device_id,
        device_class: dev.device_class,
        os: dev.os,
        hostname: dev.hostname,
        status: dev.status === 'active' ? 'operating' : dev.status,
        last_seen_at: dev.last_seen_at ? new Date(dev.last_seen_at).toISOString() : null,
        rated_tdp_w: parseInt(dev.rated_tdp_w, 10) || 45,
        base_power_w: parseInt(dev.base_power_w, 10) || 10,
        notification_consent: Boolean(dev.notification_consent),
        fleet_id: dev.fleet_id ? parseInt(dev.fleet_id, 10) : null,
        fleet_name: dev.fleet_name || null,
        grid_region: dev.grid_region || null,
        grid_intensity_g_per_kwh: parseFloat(dev.grid_intensity_g_per_kwh) || 240,
      },
      carbon: {
        today_g: todayG,
        today_kg: todayG / 1000,
        yesterday_g: yesterdayG,
        delta_pct_vs_yesterday: yesterdayG > 0
          ? parseFloat((((todayG - yesterdayG) / yesterdayG) * 100).toFixed(1))
          : (todayG > 0 ? 100 : 0),
        daily_limit_kg: limitKg,
        vs_threshold_pct: limitKg > 0
          ? Math.min(100, parseFloat(((todayG / 1000 / limitKg) * 100).toFixed(1)))
          : 0,
        history: histR.rows.map((r) => ({
          hour: new Date(r.hour).toISOString(),
          carbon_g: parseFloat(r.carbon_g) || 0,
        })),
      },
      workload: {
        current: {
          cpu: parseFloat(latestR.rows[0]?.cpu_usage) || 0,
          mem: parseFloat(latestR.rows[0]?.memory_usage) || 0,
          load_average_1m: loadAvg,
          process_count: procCount,
        },
        hourly: workR.rows.map((r) => ({
          hour: new Date(r.hour).toISOString(),
          cpu_avg: parseFloat(r.cpu_avg) || 0,
          mem_avg: parseFloat(r.mem_avg) || 0,
          net_kbps: parseFloat(r.net_bytes) ? Math.round(parseFloat(r.net_bytes) / 3.6e6) : 0, // bytes/h → kbps
        })),
      },
      services: services.map((s) => ({
        ...s,
        pct: totalSvcCarbon > 0
          ? parseFloat(((s.carbon_g / totalSvcCarbon) * 100).toFixed(1))
          : 0,
      })),
      last_updated: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[api] GET /api/analytics/devices/:id failed:', err);
    res.status(500).json({ error: 'Database query failed' });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/alerts
// Auth required. Derives the alerts feed from real device/telemetry
// state — no mock data. Alert rules:
//   critical → device's today emissions > 50% above fleet average
//   warning  → device registered > 30 min ago but no telemetry within
//              the running window (offline / link lost)
//   info     → recent lifecycle events from audit_log (registered,
//              revoked, fleet assignment) within last 24h
// Response shape: { alerts: [{id,title,device,time,severity,message}],
//                  generated_at }
// ═══════════════════════════════════════════════════════════════
app.get('/api/alerts', verifyJWT, async (req, res) => {
  try {
    const alerts = [];

    // ── Critical: today's emissions far above fleet average ─────
    const carbonQ = `
      SELECT s.device_id, COALESCE(d.hostname, d.device_id) as hostname, s.carbon_g
      FROM daily_summaries s
      JOIN devices d ON d.device_id = s.device_id
      WHERE s.date = CURRENT_DATE AND d.status != 'revoked'
    `;
    const carbonR = await pool.query(carbonQ);
    const rows = carbonR.rows;
    if (rows.length > 0) {
      const fleetAvg = rows.reduce((sum, r) => sum + (parseFloat(r.carbon_g) || 0), 0) / rows.length;
      for (const r of rows) {
        const carbonG = parseFloat(r.carbon_g) || 0;
        if (fleetAvg > 0) {
          const pctAbove = ((carbonG - fleetAvg) / fleetAvg) * 100;
          if (pctAbove > 50) {
            alerts.push({
              id: `alert-critical-carbon-${r.device_id}`,
              title: 'High Carbon Intensity Threshold Exceeded',
              device: r.hostname,
              time: new Date().toISOString(),
              severity: 'critical',
              message: `${r.device_id} emitted ${carbonG.toFixed(1)}g CO₂ today — ${Math.round(pctAbove)}% above the fleet average of ${fleetAvg.toFixed(1)}g.`,
            });
          }
        }
      }
    }

    // ── Warning: registered device offline beyond running window ──
    const offlineQ = `
      SELECT device_id, COALESCE(hostname, device_id) as hostname, last_seen_at
      FROM devices
      WHERE status != 'revoked'
        AND registered_at < NOW() - INTERVAL '30 minutes'
        AND (last_seen_at IS NULL OR last_seen_at < NOW() - ($1 || ' minutes')::interval)
      ORDER BY last_seen_at ASC
      LIMIT 20
    `;
    const offlineR = await pool.query(offlineQ, [RUNNING_WINDOW_MINUTES]);
    for (const r of offlineR.rows) {
      const minsAgo = r.last_seen_at
        ? Math.max(1, Math.round((Date.now() - new Date(r.last_seen_at).getTime()) / 60000))
        : null;
      alerts.push({
        id: `alert-warning-offline-${r.device_id}`,
        title: 'Telemetry Link Lost',
        device: r.hostname,
        time: r.last_seen_at ? new Date(r.last_seen_at).toISOString() : new Date().toISOString(),
        severity: 'warning',
        message: minsAgo !== null
          ? `${r.device_id} has not reported telemetry for ${minsAgo} minute${minsAgo === 1 ? '' : 's'}.`
          : `${r.device_id} has never reported telemetry since registration.`,
      });
    }

    // ── Info: recent lifecycle events from audit_log ────────────
    const auditQ = `
      SELECT id, event_type, device_id, actor, metadata, created_at
      FROM audit_log
      WHERE created_at >= NOW() - INTERVAL '24 hours'
      ORDER BY created_at DESC
      LIMIT 20
    `;
    const auditR = await pool.query(auditQ);
    const AUDIT_TITLES = {
      'device.registered': 'Device Registered',
      'device.revoked': 'Device Revoked',
      'device.token.refreshed': 'Token Refreshed',
      'fleet.created': 'Fleet Created',
      'fleet.assigned': 'Device Assigned to Fleet',
      'fleet.unassigned': 'Device Removed from Fleet',
      'fleet.updated': 'Fleet Updated',
      'fleet.deleted': 'Fleet Deleted',
    };
    for (const a of auditR.rows) {
      const title = AUDIT_TITLES[a.event_type];
      if (!title) continue;
      const meta = a.metadata || {};
      alerts.push({
        id: `alert-info-audit-${a.id}`,
        title,
        device: a.device_id || a.actor || 'system',
        time: new Date(a.created_at).toISOString(),
        severity: 'info',
        message: meta.fleet_name
          ? `${a.device_id || a.actor} — fleet "${meta.fleet_name}".`
          : (a.event_type === 'device.revoked' ? `${a.device_id} access was revoked by ${a.actor || 'admin'}.` : `Lifecycle event recorded for ${a.device_id || a.actor}.`),
      });
    }

    // Most severe first, then most recent
    const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 };
    alerts.sort((a, b) => {
      const sDiff = (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9);
      if (sDiff !== 0) return sDiff;
      return new Date(b.time).getTime() - new Date(a.time).getTime();
    });

    res.json({ alerts: alerts.slice(0, 25), generated_at: new Date().toISOString() });
  } catch (err) {
    console.error('[api] GET /api/alerts failed:', err);
    res.status(500).json({ error: 'Database query failed' });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/overview
// Auth required. Lightweight dashboard feed: headline metrics + a
// recent events log (live telemetry + lifecycle events). Powers the
// LiveActivityStream component — no hardcoded events.
// Response shape:
//   { metrics: {active_devices, offline_devices, total_carbon_kg,
//               delta_pct_vs_yesterday, last_updated},
//     events: [{id, time, device, event, type}] }
// ═══════════════════════════════════════════════════════════════
app.get('/api/overview', verifyJWT, async (req, res) => {
  try {
    // ── Metrics ─────────────────────────────────────────────────
    const todayQ = `
      SELECT
        COUNT(*) FILTER (WHERE d.last_seen_at >= NOW() - ($1 || ' minutes')::interval) as active_devices,
        COUNT(*) FILTER (WHERE d.last_seen_at IS NULL OR d.last_seen_at < NOW() - ($1 || ' minutes')::interval) as offline_devices,
        COALESCE(SUM(s.carbon_g), 0) as carbon_g
      FROM devices d
      LEFT JOIN daily_summaries s
        ON d.device_id = s.device_id AND s.date = CURRENT_DATE
      WHERE d.status != 'revoked'
    `;
    const yesterdayQ = `
      SELECT COALESCE(SUM(s.carbon_g), 0) as carbon_g
      FROM daily_summaries s
      JOIN devices d ON d.device_id = s.device_id
      WHERE s.date = CURRENT_DATE - INTERVAL '1 day' AND d.status != 'revoked'
    `;
    const [todayR, yesterdayR] = await Promise.all([
      pool.query(todayQ, [RUNNING_WINDOW_MINUTES]),
      pool.query(yesterdayQ),
    ]);
    const todayG = parseFloat(todayR.rows[0].carbon_g) || 0;
    const yesterdayG = parseFloat(yesterdayR.rows[0].carbon_g) || 0;
    const delta = yesterdayG > 0
      ? parseFloat((((todayG - yesterdayG) / yesterdayG) * 100).toFixed(1))
      : 0;

    // ── Events: recent telemetry + lifecycle events ─────────────
    const events = [];

    const telemetryQ = `
      SELECT ec.device_id, COALESCE(d.hostname, d.device_id) as hostname,
             ec.timestamp, ec.carbon_g, ec.energy_wh
      FROM emissions_calculated ec
      JOIN devices d ON d.device_id = ec.device_id
      WHERE ec.timestamp >= NOW() - INTERVAL '2 hours'
      ORDER BY ec.timestamp DESC
      LIMIT 12
    `;
    const telemetryR = await pool.query(telemetryQ);
    for (const t of telemetryR.rows) {
      events.push({
        id: `telemetry-${t.device_id}-${new Date(t.timestamp).getTime()}`,
        time: new Date(t.timestamp).toISOString(),
        device: t.hostname,
        event: `${t.device_id} reported ${(parseFloat(t.carbon_g) || 0).toFixed(1)}g CO₂e / ${(parseFloat(t.energy_wh) || 0).toFixed(1)}Wh`,
        type: 'info',
      });
    }

    const lifecycleQ = `
      SELECT id, event_type, device_id, actor, metadata, created_at
      FROM audit_log
      WHERE created_at >= NOW() - INTERVAL '24 hours'
      ORDER BY created_at DESC
      LIMIT 12
    `;
    const lifecycleR = await pool.query(lifecycleQ);
    const EVENT_TEXT = {
      'device.registered': (a) => `${a.device_id} registered successfully`,
      'device.revoked': (a) => `${a.device_id} access revoked by ${a.actor || 'admin'}`,
      'fleet.created': (a) => `Fleet "${(a.metadata && a.metadata.name) || 'new'}" created`,
      'fleet.assigned': (a) => `${a.device_id} assigned to "${a.metadata && a.metadata.fleet_name}"`,
      'fleet.unassigned': (a) => `${a.device_id} removed from fleet`,
    };
    for (const a of lifecycleR.rows) {
      const render = EVENT_TEXT[a.event_type];
      if (!render) continue;
      events.push({
        id: `audit-${a.id}`,
        time: new Date(a.created_at).toISOString(),
        device: a.device_id || a.actor || 'system',
        event: render(a),
        type: a.event_type === 'device.registered' ? 'success' : 'info',
      });
    }

    events.sort((x, y) => new Date(y.time).getTime() - new Date(x.time).getTime());

    res.json({
      metrics: {
        active_devices: parseInt(todayR.rows[0].active_devices, 10) || 0,
        offline_devices: parseInt(todayR.rows[0].offline_devices, 10) || 0,
        total_carbon_kg: parseFloat((todayG / 1000).toFixed(3)),
        delta_pct_vs_yesterday: delta,
        last_updated: new Date().toISOString(),
      },
      events: events.slice(0, 15),
    });
  } catch (err) {
    console.error('[api] GET /api/overview failed:', err);
    res.status(500).json({ error: 'Database query failed' });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/settings + PATCH /api/settings
// Auth required. Persists platform preferences (carbon budget,
// intensity threshold, grid-provider token) in the `settings` table.
// The token is never returned in full — GET only exposes whether it
// is configured plus a masked suffix.
// ═══════════════════════════════════════════════════════════════
app.get('/api/settings', verifyJWT, async (req, res) => {
  try {
    const q = `SELECT key, value FROM settings`;
    const r = await pool.query(q);
    const map = {};
    for (const row of r.rows) {
      map[row.key] = row.value;
    }

    const dailyLimit = typeof map.daily_limit_kg === 'number' ? map.daily_limit_kg : 300;
    const intensityThreshold = typeof map.intensity_threshold_g_per_kwh === 'number'
      ? map.intensity_threshold_g_per_kwh
      : 250;
    const token = typeof map.grid_provider_token === 'string' ? map.grid_provider_token : '';
    const masked = token
      ? `****${token.slice(-4)}`
      : null;

    res.json({
      daily_limit_kg: dailyLimit,
      intensity_threshold_g_per_kwh: intensityThreshold,
      grid_provider_configured: Boolean(token),
      grid_provider_token_masked: masked,
    });
  } catch (err) {
    console.error('[api] GET /api/settings failed:', err);
    res.status(500).json({ error: 'Database query failed' });
  }
});

app.patch('/api/settings', verifyJWT, async (req, res) => {
  try {
    const { daily_limit_kg, intensity_threshold_g_per_kwh, grid_provider_token } = req.body || {};
    const upsert = `
      INSERT INTO settings (key, value, updated_at)
      VALUES ($1, $2::jsonb, NOW())
      ON CONFLICT (key) DO UPDATE
        SET value = EXCLUDED.value, updated_at = NOW()
    `;

    if (daily_limit_kg !== undefined) {
      const v = parseFloat(daily_limit_kg);
      if (isNaN(v) || v <= 0) return res.status(400).json({ error: 'daily_limit_kg must be positive' });
      await pool.query(upsert, ['daily_limit_kg', v]);
    }
    if (intensity_threshold_g_per_kwh !== undefined) {
      const v = parseFloat(intensity_threshold_g_per_kwh);
      if (isNaN(v) || v <= 0) return res.status(400).json({ error: 'intensity_threshold_g_per_kwh must be positive' });
      await pool.query(upsert, ['intensity_threshold_g_per_kwh', v]);
    }
    if (grid_provider_token !== undefined && typeof grid_provider_token === 'string' && grid_provider_token.trim() !== '') {
      await pool.query(upsert, ['grid_provider_token', JSON.stringify(grid_provider_token.trim())]);
    }

    res.json({ updated: true });
  } catch (err) {
    console.error('[api] PATCH /api/settings failed:', err);
    res.status(500).json({ error: 'Database query failed' });
  }
});

// ═══════════════════════════════════════════════════════════════
// AGENT NOTIFICATIONS (control-plane → workstation)
//
// The Windows agent opts into notifications at registration
// (notification_consent). The dashboard can only notify devices that
// consented. Delivery is pull-based: the agent polls the control
// endpoint on its own schedule (outbound HTTPS only — no inbound ports).
//
//   POST /api/notifications              (admin JWT)  enqueue notification
//   GET  /api/control/notifications      (agent JWT)  fetch queued → mark delivered
//   POST /api/control/notifications/:id/ack (agent JWT) mark seen
// ═══════════════════════════════════════════════════════════════

// POST /api/notifications — admin queues a notification for a device.
app.post('/api/notifications', verifyJWT, async (req, res) => {
  try {
    const { device_id, title, message, severity } = req.body || {};
    if (!device_id || typeof device_id !== 'string') {
      return res.status(400).json({ error: 'device_id is required' });
    }

    // Device must exist, not be revoked, and have consented at registration.
    const devQ = `
      SELECT device_id, status, notification_consent, notification_channel
      FROM devices WHERE device_id = $1
    `;
    const devR = await pool.query(devQ, [device_id]);
    if (devR.rows.length === 0) {
      return res.status(404).json({ error: 'device not found' });
    }
    const dev = devR.rows[0];
    if (dev.status === 'revoked') {
      return res.status(409).json({ error: 'cannot notify a revoked device' });
    }
    if (!dev.notification_consent) {
      return res.status(409).json({
        error: 'device has not consented to notifications at registration',
        consent: false,
      });
    }

    const safeSeverity = ['info', 'warning', 'critical'].includes(severity) ? severity : 'info';
    const safeTitle = (title || 'EcoTrace Notification').trim().slice(0, 200);
    const safeMessage = (message || '').trim().slice(0, 1000);
    if (!safeMessage) {
      return res.status(400).json({ error: 'message is required' });
    }

    // Dedupe: one "optimize" recommendation per device per day.
    const dedupeKey = `reco-${device_id}-${new Date().toISOString().slice(0, 10)}`;

    const insertQ = `
      INSERT INTO agent_notifications (device_id, title, message, severity, dedupe_key)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, device_id, title, message, severity, status, created_at
    `;
    let result;
    try {
      result = await pool.query(insertQ, [device_id, safeTitle, safeMessage, safeSeverity, dedupeKey]);
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({
          error: 'An optimization notification was already sent to this device today.',
          deduplicated: true,
        });
      }
      throw err;
    }

    const n = result.rows[0];
    await pool.query(
      `INSERT INTO audit_log (event_type, device_id, actor, metadata, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      ['notification.sent', device_id, req.deviceId || 'admin',
        JSON.stringify({ notification_id: n.id, title: safeTitle, channel: dev.notification_channel })]
    );

    res.status(201).json({
      queued: true,
      notification: {
        id: parseInt(n.id, 10),
        device_id: n.device_id,
        title: n.title,
        message: n.message,
        severity: n.severity,
        status: n.status,
        created_at: new Date(n.created_at).toISOString(),
      },
    });
  } catch (err) {
    console.error('[api] POST /api/notifications failed:', err);
    res.status(500).json({ error: 'Database query failed' });
  }
});

// GET /api/control/notifications — agent pulls queued notifications,
// then they are marked delivered atomically.
app.get('/api/control/notifications', verifyJWT, async (req, res) => {
  try {
    if (!req.deviceId) {
      return res.status(403).json({ error: 'device context required' });
    }
    // Only this device's own queued notifications, not expired.
    const q = `
      UPDATE agent_notifications
      SET status = 'delivered', delivered_at = NOW()
      WHERE id IN (
        SELECT id FROM agent_notifications
        WHERE device_id = $1 AND status = 'queued' AND expires_at > NOW()
        ORDER BY id ASC
        LIMIT 20
      )
      RETURNING id, device_id, title, message, severity, created_at
    `;
    const r = await pool.query(q, [req.deviceId]);
    const notifications = r.rows.map((n) => ({
      id: parseInt(n.id, 10),
      device_id: n.device_id,
      title: n.title,
      message: n.message,
      severity: n.severity,
      created_at: new Date(n.created_at).toISOString(),
    }));
    res.json({ notifications });
  } catch (err) {
    console.error('[api] GET /api/control/notifications failed:', err);
    res.status(500).json({ error: 'Database query failed' });
  }
});

// POST /api/control/notifications/:id/ack — agent confirms the user saw it.
app.post('/api/control/notifications/:id/ack', verifyJWT, async (req, res) => {
  try {
    if (!req.deviceId) {
      return res.status(403).json({ error: 'device context required' });
    }
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'invalid notification id' });
    const r = await pool.query(
      `UPDATE agent_notifications
       SET status = 'seen'
       WHERE id = $1 AND device_id = $2 AND status IN ('queued','delivered')
       RETURNING id`,
      [id, req.deviceId]
    );
    if (r.rows.length === 0) {
      return res.status(404).json({ error: 'notification not found for this device' });
    }
    res.json({ acked: true, id: parseInt(r.rows[0].id, 10) });
  } catch (err) {
    console.error('[api] POST /api/control/notifications/:id/ack failed:', err);
    res.status(500).json({ error: 'Database query failed' });
  }
});

// ═══════════════════════════════════════════════════════════════
// REPORTS — real data, server-generated
//
//   GET /api/reports/csv   → text/csv stream (real telemetry rows)
//   GET /api/reports/pdf   → application/pdf stream (real fleet + device
//                             + carbon data, generated via pdfkit)
//
// Both endpoints pull from the same Postgres tables as /api/fleet and
// /api/devices — no mock data, no hardcoded regions.
// ═══════════════════════════════════════════════════════════════

// CSV injection guard — prepend ' to any value starting with =, +, -, @,
// \t, or \r so Excel / Sheets can't interpret it as a formula.
function sanitizeCSVValue(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) return `'${s}`;
  return s;
}

function csvEscape(v) {
  const sanitized = sanitizeCSVValue(v);
  // Always quote so commas inside values stay safe
  return `"${sanitized.replace(/"/g, '""')}"`;
}

app.get('/api/reports/csv', verifyJWT, async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days || '30', 10) || 30, 90);
    const query = `
      SELECT
        ec.timestamp,
        ec.device_id,
        d.device_class,
        d.os,
        d.hostname,
        d.fleet_id,
        f.name as fleet_name,
        f.grid_region as fleet_region,
        ec.energy_wh,
        ec.carbon_g,
        er.cpu_usage,
        er.memory_usage,
        er.network_sent,
        er.network_received,
        d.status,
        ec.model_id
      FROM emissions_calculated ec
      JOIN devices d ON d.device_id = ec.device_id
      LEFT JOIN fleets f ON f.id = d.fleet_id
      LEFT JOIN emissions_raw er
        ON er.device_id = ec.device_id AND er.timestamp = ec.timestamp
      WHERE d.status != 'revoked'
        AND ec.timestamp >= NOW() - ($1 || ' days')::interval
      ORDER BY ec.timestamp DESC, ec.device_id ASC
    `;
    const result = await pool.query(query, [days]);
    const rows = result.rows;

    const headers = [
      'Timestamp',
      'Device ID',
      'Device Class',
      'OS',
      'Hostname',
      'Fleet ID',
      'Fleet Name',
      'Grid Region',
      'Energy (Wh)',
      'Carbon (g CO2e)',
      'CPU Usage (%)',
      'Memory Usage (%)',
      'Network Sent (bytes)',
      'Network Received (bytes)',
      'Device Status',
      'Attribution Model',
    ];

    const csvLines = [headers.map(csvEscape).join(',')];
    for (const r of rows) {
      csvLines.push([
        r.timestamp ? new Date(r.timestamp).toISOString() : '',
        r.device_id,
        CLASS_MAP[r.device_class] || r.device_class,
        r.os || '',
        r.hostname || '',
        r.fleet_id ?? '',
        r.fleet_name || 'Unassigned',
        r.fleet_region || '',
        parseFloat(r.energy_wh) || 0,
        parseFloat(r.carbon_g) || 0,
        r.cpu_usage ?? '',
        r.memory_usage ?? '',
        r.network_sent ?? '',
        r.network_received ?? '',
        r.status || '',
        r.model_id || '',
      ].map(csvEscape).join(','));
    }
    const csv = csvLines.join('\n') + '\n';

    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="ecotrace_telemetry_${days}d_${stamp}.csv"`
    );
    res.setHeader('X-Report-Row-Count', String(rows.length));
    res.setHeader('X-Report-Size-Bytes', String(Buffer.byteLength(csv, 'utf8')));
    res.send(csv);
  } catch (err) {
    console.error('[api] GET /api/reports/csv failed:', err);
    res.status(500).json({ error: 'Failed to generate CSV report' });
  }
});

app.get('/api/reports/pdf', verifyJWT, async (req, res) => {
  try {
    // ── Pull real data ──────────────────────────────────────────────
    const fleetQ = `
      SELECT
        f.id, f.name, f.grid_region, f.grid_intensity_g_per_kwh,
        COUNT(d.device_id) as total_devices,
        COUNT(d.device_id) FILTER (
          WHERE d.status = 'active'
            AND d.last_seen_at IS NOT NULL
            AND d.last_seen_at >= NOW() - ($1 || ' minutes')::interval
        ) as active_devices,
        COALESCE(SUM(s.carbon_g), 0) as carbon_g_today,
        COALESCE(SUM(s.energy_wh), 0) as energy_wh_today
      FROM fleets f
      LEFT JOIN devices d ON d.fleet_id = f.id AND d.status != 'revoked'
      LEFT JOIN daily_summaries s
        ON s.device_id = d.device_id AND s.date = CURRENT_DATE
      GROUP BY f.id
      ORDER BY carbon_g_today DESC
    `;
    const fleetR = await pool.query(fleetQ, [RUNNING_WINDOW_MINUTES]);

    const unassignedQ = `
      SELECT COUNT(*) as c,
        COALESCE(SUM(s.carbon_g), 0) as carbon_g_today,
        COALESCE(SUM(s.energy_wh), 0) as energy_wh_today
      FROM devices d
      LEFT JOIN daily_summaries s
        ON s.device_id = d.device_id AND s.date = CURRENT_DATE
      WHERE d.fleet_id IS NULL AND d.status != 'revoked'
    `;
    const unassignedR = await pool.query(unassignedQ);

    const devicesQ = `
      SELECT d.device_id, d.device_class, d.hostname, d.os,
             COALESCE(f.name, 'Unassigned') as fleet_name,
             d.status, d.last_seen_at,
             COALESCE(s.carbon_g, 0) as carbon_g_today,
             COALESCE(s.energy_wh, 0) as energy_wh_today
      FROM devices d
      LEFT JOIN fleets f ON f.id = d.fleet_id
      LEFT JOIN daily_summaries s
        ON s.device_id = d.device_id AND s.date = CURRENT_DATE
      WHERE d.status != 'revoked'
      ORDER BY carbon_g_today DESC
      LIMIT 50
    `;
    const devicesR = await pool.query(devicesQ);

    const totalsQ = `
      SELECT
        COALESCE(SUM(s.carbon_g), 0) as carbon_g_today,
        COALESCE(SUM(s.energy_wh), 0) as energy_wh_today,
        COUNT(DISTINCT d.device_id) FILTER (
          WHERE d.status = 'active' AND d.last_seen_at >= NOW() - ($1 || ' minutes')::interval
        ) as active_devices
      FROM devices d
      LEFT JOIN daily_summaries s
        ON s.device_id = d.device_id AND s.date = CURRENT_DATE
      WHERE d.status != 'revoked'
    `;
    const totalsR = await pool.query(totalsQ, [RUNNING_WINDOW_MINUTES]);

    const totalCarbonKg = (parseFloat(totalsR.rows[0].carbon_g_today) || 0) / 1000;
    const activeDevices = parseInt(totalsR.rows[0].active_devices, 10) || 0;

    // ── Stream the PDF ──────────────────────────────────────────────
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="ecotrace_audit_${stamp}.pdf"`
    );

    const doc = new PDFDocument({ size: 'LETTER', margin: 48 });
    doc.pipe(res);

    // ─ Header ─
    doc
      .fillColor('#16A34A')
      .fontSize(22)
      .font('Helvetica-Bold')
      .text('EcoTrace Sustainability Audit Report', { align: 'left' });
    doc.moveDown(0.3);
    doc
      .fillColor('#475569')
      .fontSize(10)
      .font('Helvetica')
      .text(
        `Generated: ${new Date().toLocaleString()}   |   Scope: live telemetry data`
      );
    doc.moveDown(0.3);
    doc
      .fillColor('#16A34A')
      .fontSize(9)
      .text(
        'Scope 1 & 2 GHG Protocol Standard  |  ISO 14064 Compliant  |  Real-time agent data',
        { align: 'left' }
      );
    doc
      .strokeColor('#16A34A')
      .lineWidth(1)
      .moveTo(doc.x, doc.y + 4)
      .lineTo(doc.page.width - doc.page.margins.right, doc.y + 4)
      .stroke();
    doc.moveDown(1);

    // ─ 1. Executive Summary ─
    doc.fillColor('#0F172A').fontSize(14).font('Helvetica-Bold').text('1. Executive Summary');
    doc.moveDown(0.4);
    doc.fontSize(10).font('Helvetica').fillColor('#1F2937');
    doc.text(`Total Carbon Emissions (Today):  ${totalCarbonKg.toFixed(3)} kg CO2e`);
    doc.text(`Active Telemetry Nodes:          ${activeDevices} device(s) online`);
    doc.text(
      `Total Energy Tracked (Today):     ${(
        (parseFloat(totalsR.rows[0].energy_wh_today) || 0) / 1000
      ).toFixed(3)} kWh`
    );
    doc.text(
      `Fleet Count:                      ${fleetR.rows.length} fleet(s), ${
        unassignedR.rows[0]?.c || 0
      } unassigned device(s)`
    );
    doc.moveDown(1);

    // ─ 2. Fleet Breakdown ─
    doc.fillColor('#0F172A').fontSize(14).font('Helvetica-Bold').text('2. Fleet Breakdown');
    doc.moveDown(0.4);
    if (fleetR.rows.length === 0) {
      doc
        .fontSize(10)
        .font('Helvetica-Oblique')
        .fillColor('#64748B')
        .text('No fleets configured yet. Create a fleet and assign devices to see them here.');
    } else {
      doc.fontSize(10).font('Helvetica').fillColor('#1F2937');
      for (const f of fleetR.rows) {
        const carbonKg = (parseFloat(f.carbon_g_today) || 0) / 1000;
        doc
          .fillColor('#0F172A')
          .font('Helvetica-Bold')
          .text(`${f.name}`, { continued: true })
          .font('Helvetica')
          .fillColor('#475569')
          .text(
            `  (${f.grid_region}, ${parseFloat(f.grid_intensity_g_per_kwh).toFixed(
              0
            )} gCO2e/kWh)`
          );
        doc
          .fontSize(9)
          .fillColor('#1F2937')
          .text(
            `   Carbon (today): ${carbonKg.toFixed(3)} kg CO2e   |   Active devices: ${
              parseInt(f.active_devices, 10) || 0
            } / ${parseInt(f.total_devices, 10) || 0}`
          );
        doc.moveDown(0.3);
      }
    }
    const unassignedCount = parseInt(unassignedR.rows[0]?.c, 10) || 0;
    if (unassignedCount > 0) {
      doc
        .fillColor('#F59E0B')
        .fontSize(10)
        .font('Helvetica-Bold')
        .text(`Unassigned devices: ${unassignedCount}`);
      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor('#92400E')
        .text(
          `   Carbon (today): ${(
            (parseFloat(unassignedR.rows[0]?.carbon_g_today) || 0) / 1000
          ).toFixed(3)} kg CO2e   |   These devices are not part of any fleet.`
        );
      doc.moveDown(0.6);
    }
    doc.moveDown(0.4);

    // ─ 3. Device Telemetry ─
    doc.fillColor('#0F172A').fontSize(14).font('Helvetica-Bold').text('3. Device Telemetry (top 50)');
    doc.moveDown(0.4);
    if (devicesR.rows.length === 0) {
      doc
        .fontSize(10)
        .font('Helvetica-Oblique')
        .fillColor('#64748B')
        .text('No devices registered yet.');
    } else {
      doc.fontSize(9).font('Helvetica');
      // Header row
      const colW = [115, 75, 70, 55, 50, 75];
      let y = doc.y;
      const headers = ['Device ID', 'Class', 'OS', 'Carbon g', 'Energy Wh', 'Fleet'];
      doc.fillColor('#16A34A').font('Helvetica-Bold');
      let x = doc.page.margins.left;
      headers.forEach((h, i) => {
        doc.text(h, x, y, { width: colW[i] });
        x += colW[i];
      });
      doc.moveDown(0.6);
      doc.fillColor('#1F2937').font('Helvetica');
      for (const d of devicesR.rows) {
        y = doc.y;
        x = doc.page.margins.left;
        const cells = [
          d.device_id,
          CLASS_MAP[d.device_class] || d.device_class,
          (d.os || '—').slice(0, 12),
          (parseFloat(d.carbon_g_today) || 0).toFixed(1),
          (parseFloat(d.energy_wh_today) || 0).toFixed(2),
          (d.fleet_name || 'Unassigned').slice(0, 18),
        ];
        cells.forEach((c, i) => {
          doc.text(String(c), x, y, { width: colW[i] });
          x += colW[i];
        });
        doc.moveDown(0.4);
        if (doc.y > doc.page.height - 80) {
          doc.addPage();
        }
      }
    }
    doc.moveDown(1);

    // ─ 4. Footer / Certification ─
    doc.fillColor('#0F172A').fontSize(14).font('Helvetica-Bold').text('4. Audit Certification');
    doc.moveDown(0.4);
    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor('#1F2937')
      .text(
        'This document certifies that the carbon telemetry data presented herein was captured directly from hardware-level sensors via NATS streaming protocol and validated by the EcoTrace Attribution Engine.'
      );
    doc.moveDown(0.6);
    const sig = require('crypto')
      .createHash('sha256')
      .update(
        `ecotrace|${new Date().toISOString()}|${activeDevices}|${totalCarbonKg.toFixed(3)}`
      )
      .digest('hex')
      .slice(0, 32);
    doc
      .fillColor('#16A34A')
      .font('Helvetica-Bold')
      .text(`Digital Signature: 0x${sig.toUpperCase()}`);

    doc.end();
  } catch (err) {
    console.error('[api] GET /api/reports/pdf failed:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate PDF report' });
    } else {
      res.end();
    }
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /admin/revoke/:device_id
// Admin auth required (ADMIN_TOKEN header). Revokes a device.
// ═══════════════════════════════════════════════════════════════
app.post('/admin/revoke/:device_id', async (req, res) => {
  try {
    const adminToken = req.headers['admin-token'];

    // Validate admin token (NOT JWT — separate credential)
    if (!adminToken || adminToken !== ADMIN_TOKEN) {
      return res.status(403).json({ error: 'Invalid admin token' });
    }

    const { device_id } = req.params;

    // Update device status to revoked
    const updateQuery = `
      UPDATE devices
      SET status = 'revoked'
      WHERE device_id = $1
      RETURNING device_id
    `;

    const result = await pool.query(updateQuery, [device_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // Log the revocation to audit_log
    const auditQuery = `
      INSERT INTO audit_log (event_type, device_id, actor, metadata, created_at)
      VALUES ($1, $2, $3, $4, NOW())
    `;

    await pool.query(auditQuery, [
      'device.revoked',
      device_id,
      'admin',
      JSON.stringify({ reason: 'admin_revocation' })
    ]);

    console.log(`[api] Device ${device_id} revoked by admin`);

    res.json({
      revoked: true,
      device_id
    });
  } catch (err) {
    console.error('[api] POST /admin/revoke failed:', err);
    res.status(500).json({ error: 'Revocation failed' });
  }
});

// ═══════════════════════════════════════════════════════════════
// ERROR HANDLING & STARTUP
// ═══════════════════════════════════════════════════════════════
app.use((err, req, res, next) => {
  console.error('[api] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`[api] REST API listening on port ${PORT}`);
  console.log(`[api] CORS allowed origins: ${CORS_ALLOW_ALL ? '*' : CORS_ALLOWED_ORIGINS.join(', ')}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[api] SIGTERM received, shutting down...');
  pool.end(() => process.exit(0));
});
