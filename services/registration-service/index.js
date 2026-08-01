// services/registration-service/index.js
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

const BOOTSTRAP_TOKEN = process.env.BOOTSTRAP_TOKEN || 'dev-bootstrap-token';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Used bootstrap tokens — in-memory for now (reset on restart)
// For production: store in DB. For demo: fine as-is.
const usedTokens = new Set();

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.post('/register', async (req, res) => {
  const { bootstrap_token, public_key, device_class = 'linux', hostname, os } = req.body;

  if (!bootstrap_token || bootstrap_token !== BOOTSTRAP_TOKEN) {
    return res.status(401).json({ error: 'invalid or missing bootstrap_token' });
  }

  if (usedTokens.has(bootstrap_token + hostname)) {
    // Allow same host to re-register if they lost credentials
    // In production: enforce single-use strictly
  }

  const device_id = `${device_class}-${uuidv4().slice(0, 8)}`;

  try {
    await pool.query(
      `INSERT INTO devices (device_id, device_class, os, hostname, status)
       VALUES ($1, $2, $3, $4, 'active')
       ON CONFLICT (device_id) DO NOTHING`,
      [device_id, device_class, os, hostname]
    );

    await pool.query(
      `INSERT INTO audit_log (event_type, device_id, metadata)
       VALUES ('device.registered', $1, $2)`,
      [device_id, JSON.stringify({ device_class, os, hostname })]
    );
  } catch (err) {
    console.error('[registration] DB error:', err.message);
    return res.status(500).json({ error: 'registration failed' });
  }

  const now = Math.floor(Date.now() / 1000);
  const access_token = jwt.sign(
    { device_id, device_class, iat: now, exp: now + 3600 },
    JWT_SECRET
  );

  usedTokens.add(bootstrap_token + hostname);

  res.json({
    device_id,
    access_token,
    expires_at: new Date((now + 3600) * 1000).toISOString(),
  });
});

app.listen(3002, () => console.log('[registration-service] listening on :3002'));