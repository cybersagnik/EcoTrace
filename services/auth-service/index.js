// services/auth-service/index.js (Node.js stub)
const express = require('express');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const JWT_EXPIRY = parseInt(process.env.JWT_EXPIRY_MINUTES || '60') * 60;

// Issue a JWT for a device
app.post('/token', (req, res) => {
  const { device_id, secret } = req.body;
  if (!device_id) {
    return res.status(400).json({ error: 'device_id required' });
  }

  const now = Math.floor(Date.now() / 1000);
  const token = jwt.sign(
    {
      device_id,
      device_class: req.body.device_class || 'linux',
      iat: now,
      exp: now + JWT_EXPIRY,
    },
    JWT_SECRET
  );

  res.json({
    access_token: token,
    expires_at: new Date((now + JWT_EXPIRY) * 1000).toISOString(),
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Verify endpoint — called by nginx auth_request
// Returns 200 (valid) or 401 (invalid/expired)
app.get('/verify', (req, res) => {
  const auth = req.headers['authorization'] || '';
  const token = auth.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'no token' });
  }

  try {
    const claims = jwt.verify(token, JWT_SECRET);
    // Forward device context to upstream via headers
    res.set('X-Device-ID', claims.device_id);
    res.set('X-Device-Class', claims.device_class);
    res.status(200).json({ valid: true, claims });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

app.listen(3001, () => console.log('[auth-service] listening on :3001'));