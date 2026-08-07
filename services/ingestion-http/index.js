'use strict';
const express = require('express');
const { connect, StringCodec } = require('nats');

const app  = express();
const PORT = process.env.PORT || 4318;
const NATS_URL = process.env.NATS_URL || 'nats://nats:4222';

// Parse all JSON regardless of content-type
app.use(express.json({ limit: '1mb', type: () => true }));

let natsClient = null;
const sc = StringCodec();

// Connect to NATS on startup
async function connectNATS() {
  try {
    natsClient = await connect({ servers: NATS_URL });
    console.log(`[ingestion] connected to NATS at ${NATS_URL}`);
  } catch (err) {
    console.error('[ingestion] NATS connection failed:', err.message);
    setTimeout(connectNATS, 3000);
  }
}

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    nats: natsClient ? 'connected' : 'disconnected'
  });
});

// OTLP HTTP traces endpoint — receives from nginx, publishes to NATS
app.post('/v1/traces', (req, res) => {
  if (!natsClient) {
    return res.status(503).json({ error: 'NATS not connected' });
  }

  const deviceId    = req.headers['x-device-id']    || 'unknown';
  const deviceClass = req.headers['x-device-class'] || 'unknown';

  console.log(`[ingestion] received POST /v1/traces from device_id=${deviceId}`);
  console.log(`[ingestion] request body type: ${typeof req.body}`);
  console.log(`[ingestion] request body keys: ${req.body ? Object.keys(req.body).join(', ') : 'none'}`);

  // Extract the _ecotrace_envelope from the OTLP body (sent by agent)
  const ecotrace_envelope = req.body?._ecotrace_envelope;
  
  if (ecotrace_envelope) {
    console.log(`[ingestion] found _ecotrace_envelope with device_id=${ecotrace_envelope.device_id || ecotrace_envelope.DeviceId}`);
  } else {
    console.log(`[ingestion] WARNING: _ecotrace_envelope not found in body`);
    if (req.body?.resourceSpans) {
      console.log(`[ingestion] body contains resourceSpans (OTLP format)`);
    }
  }

  const payload = JSON.stringify({
    received_at:        new Date().toISOString(),
    device_id:          deviceId,
    device_class:       deviceClass,
    _ecotrace_envelope: ecotrace_envelope,
  });

  try {
    natsClient.publish('telemetry.raw', sc.encode(payload));
    console.log(`[ingestion] published to telemetry.raw device_id=${deviceId}`);
    res.status(200).json({ status: 'accepted' });
  } catch (err) {
    console.error('[ingestion] publish failed:', err.message);
    res.status(500).json({ error: 'publish failed' });
  }
});

connectNATS();
app.listen(PORT, () => {
  console.log(`[ingestion] listening on :${PORT}`);
});
