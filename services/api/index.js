const express = require('express');
const { Pool } = require('pg');
const axios = require('axios');

require('dotenv').config();

const app = express();
app.use(express.json());

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://ecotrace:[REDACTED]@postgres:5432/ecotrace';
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://auth-service:3001';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'changeme';
const PORT = process.env.PORT || 3003;

const pool = new Pool({ connectionString: DATABASE_URL });

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
// GET /api/devices
// Auth required. Returns device list with today's carbon/energy.
// ═══════════════════════════════════════════════════════════════
app.get('/api/devices', verifyJWT, async (req, res) => {
  try {
    const query = `
      SELECT 
        d.device_id,
        d.device_class,
        d.os,
        d.hostname,
        d.status,
        d.last_seen_at,
        COALESCE(s.carbon_g, 0) as carbon_g_today,
        COALESCE(s.energy_wh, 0) as energy_wh_today,
        COALESCE(s.sample_count, 0) as sample_count
      FROM devices d
      LEFT JOIN daily_summaries s
        ON d.device_id = s.device_id AND s.date = CURRENT_DATE
      WHERE d.status != 'revoked'
      ORDER BY carbon_g_today DESC
    `;
    
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error('[api] GET /api/devices failed:', err);
    res.status(500).json({ error: 'Database query failed' });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/fleet
// Auth required. Returns fleet aggregates for today.
// ═══════════════════════════════════════════════════════════════
app.get('/api/fleet', verifyJWT, async (req, res) => {
  try {
    const query = `
      SELECT 
        COUNT(DISTINCT d.device_id) as active_devices,
        COALESCE(SUM(s.carbon_g), 0) as total_carbon_g,
        COALESCE(SUM(s.energy_wh), 0) as total_energy_wh,
        NOW() as as_of
      FROM devices d
      LEFT JOIN daily_summaries s
        ON d.device_id = s.device_id AND s.date = CURRENT_DATE
      WHERE d.status = 'active'
    `;
    
    const result = await pool.query(query);
    const row = result.rows[0];
    
    res.json({
      active_devices: parseInt(row.active_devices, 10),
      total_carbon_g: parseFloat(row.total_carbon_g),
      total_energy_wh: parseFloat(row.total_energy_wh),
      as_of: row.as_of
    });
  } catch (err) {
    console.error('[api] GET /api/fleet failed:', err);
    res.status(500).json({ error: 'Database query failed' });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/devices/:id/history
// Auth required. Returns last 24 hours of hourly carbon data (P1).
// ═══════════════════════════════════════════════════════════════
app.get('/api/devices/:id/history', verifyJWT, async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT 
        DATE_TRUNC('hour', timestamp) as hour,
        SUM(carbon_g) as carbon_g
      FROM emissions_calculated
      WHERE device_id = $1 AND timestamp >= NOW() - INTERVAL '24 hours'
      GROUP BY hour
      ORDER BY hour ASC
    `;
    
    const result = await pool.query(query, [id]);
    
    const data = result.rows.map(row => ({
      hour: row.hour,
      carbon_g: parseFloat(row.carbon_g)
    }));
    
    res.json(data);
  } catch (err) {
    console.error('[api] GET /api/devices/:id/history failed:', err);
    res.status(500).json({ error: 'Database query failed' });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/recommendation
// Auth required. Finds highest-emitter device & computes recommendation.
// ═══════════════════════════════════════════════════════════════
app.get('/api/recommendation', verifyJWT, async (req, res) => {
  try {
    // Get highest emitter today
    const topQuery = `
      SELECT device_id, carbon_g FROM daily_summaries
      WHERE date = CURRENT_DATE
      ORDER BY carbon_g DESC
      LIMIT 1
    `;
    
    // Get fleet average today
    const avgQuery = `
      SELECT AVG(carbon_g) as avg_carbon FROM daily_summaries
      WHERE date = CURRENT_DATE
    `;
    
    const topResult = await pool.query(topQuery);
    const avgResult = await pool.query(avgQuery);
    
    if (topResult.rows.length === 0) {
      return res.json({ recommendation: 'No data available yet.' });
    }
    
    const topDevice = topResult.rows[0];
    const fleetAvg = parseFloat(avgResult.rows[0].avg_carbon || 0);
    
    const percentAbove = fleetAvg > 0 ? 
      Math.round(((topDevice.carbon_g - fleetAvg) / fleetAvg) * 100) : 0;
    
    const recommendation = 
      `Device ${topDevice.device_id} emitted ${topDevice.carbon_g.toFixed(2)}g CO₂ today — ` +
      `${percentAbove}% above fleet average. Consider suspending idle background processes.`;
    
    res.json({
      device_id: topDevice.device_id,
      carbon_g_today: parseFloat(topDevice.carbon_g),
      fleet_avg_carbon_g: fleetAvg,
      recommendation
    });
  } catch (err) {
    console.error('[api] GET /api/recommendation failed:', err);
    res.status(500).json({ error: 'Database query failed' });
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
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[api] SIGTERM received, shutting down...');
  pool.end(() => process.exit(0));
});
