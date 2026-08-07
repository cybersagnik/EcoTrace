'use strict';

const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const { connect, StringCodec, JSONCodec } = require('nats');

const PORT = parseInt(process.env.PORT || '3010', 10);
const NATS_URL = process.env.NATS_URL || 'nats://nats:4222';
const SUBJECTS = (process.env.NATS_SUBJECTS || 'telemetry.raw').split(',').map(s => s.trim()).filter(Boolean);

const jc = JSONCodec();
const sc = StringCodec();

const app = express();
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    nats: natsClient ? 'connected' : 'disconnected',
    subjects: SUBJECTS,
    clients: wss ? wss.clients.size : 0,
  });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

let natsClient = null;

async function connectNATS() {
  try {
    natsClient = await connect({ servers: NATS_URL });
    console.log(`[ws] connected to NATS at ${NATS_URL}`);

    for (const subject of SUBJECTS) {
      const sub = natsClient.subscribe(subject);
      console.log(`[ws] subscribed to ${subject}`);
      (async () => {
        for await (const msg of sub) {
          let parsed;
          try {
            parsed = jc.decode(msg.data);
          } catch {
            try {
              parsed = JSON.parse(sc.decode(msg.data));
            } catch {
              parsed = { raw: sc.decode(msg.data) };
            }
          }

          const envelope = {
            type: subject === 'telemetry.raw' ? 'telemetry' : 'nats.message',
            subject,
            received_at: new Date().toISOString(),
            payload: parsed,
          };

          const frame = JSON.stringify(envelope);
          for (const client of wss.clients) {
            if (client.readyState === 1 /* OPEN */) {
              try {
                client.send(frame);
              } catch (err) {
                // drop silently; client will be cleaned up on close
              }
            }
          }
        }
      })();
    }
  } catch (err) {
    console.error('[ws] NATS connection failed:', err.message);
    setTimeout(connectNATS, 3000);
  }
}

wss.on('connection', (socket, req) => {
  const remote = req.socket.remoteAddress;
  console.log(`[ws] client connected from ${remote}, total=${wss.clients.size}`);
  socket.send(JSON.stringify({ type: 'hello', ts: Date.now(), subjects: SUBJECTS }));

  socket.on('close', () => {
    console.log(`[ws] client disconnected from ${remote}, total=${wss.clients.size}`);
  });
  socket.on('error', (err) => {
    console.warn(`[ws] client error from ${remote}:`, err.message);
  });
});

server.listen(PORT, () => {
  console.log(`[ws] WebSocket bridge listening on :${PORT} (path /ws)`);
  connectNATS();
});

process.on('SIGTERM', () => {
  console.log('[ws] SIGTERM received, shutting down...');
  server.close(() => process.exit(0));
});
