// services/ai-advisor/store.js
// ─────────────────────────────────────────────────────────────────────
// Persists Gemini insights into ai_alerts with SHA-256 fingerprint
// dedupe so scheduled re-runs never flood the feed, and expires stale
// insights (they roll out of the merged /api/alerts feed automatically
// after the 48h window).

const crypto = require('crypto');

const SEVERITIES = new Set(['critical', 'warning', 'info']);

function stable(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function fingerprintOf(insight) {
  const base = [insight.category, insight.device_id, stable(insight.title), stable(insight.message)].join('|');
  return crypto.createHash('sha256').update(base).digest('hex');
}

function sanitizeInsights(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    const title = stable(item?.title);
    const message = stable(item?.message);
    const severity = SEVERITIES.has(item?.severity) ? item.severity : 'info';
    if (!title || !message) continue;

    const confidence = Number(item?.confidence);
    const evidence = Array.isArray(item?.evidence)
      ? item.evidence.slice(0, 12)
      : (item?.evidence ? [item.evidence] : []);

    out.push({
      severity,
      title: title.slice(0, 160),
      message: message.slice(0, 500),
      category: String(item?.category || 'analysis').slice(0, 40),
      device_id: item?.device_id ? String(item.device_id).slice(0, 64) : null,
      confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : null,
      evidence,
      recommendation: item?.recommendation ? stable(item.recommendation).slice(0, 500) : null,
      source: 'gemini',
      fingerprint: fingerprintOf({ category: item?.category, device_id: item?.device_id, title, message }),
    });
  }
  return out;
}

async function upsertAiAlerts(pool, insights) {
  const clean = sanitizeInsights(insights);
  if (clean.length === 0) return { inserted: 0, filtered: insights.length };

  let inserted = 0;
  for (const i of clean) {
    const r = await pool.query(
      `INSERT INTO ai_alerts
         (fingerprint, severity, title, message, category, device_id, confidence, evidence, recommendation, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (fingerprint) DO NOTHING
       RETURNING id`,
      [i.fingerprint, i.severity, i.title, i.message, i.category, i.device_id, i.confidence, JSON.stringify(i.evidence), i.recommendation, i.source]
    );
    if (r.rowCount > 0) inserted += 1;
  }
  return { inserted, filtered: clean.length };
}

async function expireAiAlerts(pool, hours = 48) {
  const r = await pool.query(
    `UPDATE ai_alerts SET status = 'expired'
     WHERE status = 'active' AND created_at < NOW() - ($1::int || ' hours')::interval`,
    [hours]
  );
  return r.rowCount || 0;
}

module.exports = { upsertAiAlerts, expireAiAlerts, sanitizeInsights };