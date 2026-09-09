// services/ai-advisor/index.js
// ─────────────────────────────────────────────────────────────────────
// EcoTrace AI Advisor — scheduled cloud-inference telemetry analysis.
//
// The scheduler is the "background agent": it periodically builds a
// compact data snapshot from Postgres, sends it to OpenCode Zen for
// analysis (model: big-pickle), and persists schema-valid insights to
// ai_alerts. The main REST API merges those insights into the /api/alerts
// feed.
//
// On-demand endpoints (JWT-protected at the nginx edge):
//   GET  /health                    liveness (container healthcheck)
//   GET  /status                    last run, success/error, insight count
//   POST /analyze                   trigger a scheduled-style run (throttled)
//   POST /analyze-qa                analyze a frontend-supplied QA snapshot

const express = require('express');
const { Pool } = require('pg');

require('dotenv').config();

const app = express();
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 3005;
const DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://ecotrace:dummy@postgres:5432/ecotrace';
const AI_ADVISOR_INTERVAL_MS = parseInt(process.env.AI_ADVISOR_INTERVAL_MS || '1800000', 10);
const MANUAL_RUN_COOLDOWN_MS = parseInt(process.env.MANUAL_RUN_COOLDOWN_MS || '600000', 10);
const MAX_INSIGHTS_PER_RUN = 12;

const pool = new Pool({ connectionString: DATABASE_URL });

const { buildContext, fingerprint } = require('./context');
const { generateStructured, isConfigured } = require('./llm');
const { upsertAiAlerts, expireAiAlerts } = require('./store');

// ─── Runtime state (in-memory; resets on restart) ───────────────────
const state = {
  lastRunAt: null,
  lastRunSuccess: null,
  lastRunError: null,
  lastFingerprint: null,
  lastInsightCount: 0,
  scheduledEnabled: true,
};

const SCHEDULED_SYSTEM_PROMPT = `You are the EcoTrace AI sustainability advisor.
You analyze carbon/energy telemetry for a fleet of IT devices and surface actionable insights.

Response format (JSON object):
{
  "insights": [
    {
      "title": "short headline",
      "message": "one or two crisp sentences with the key numbers",
      "severity": "critical" | "warning" | "info",
      "category": "e.g. carbon, efficiency, workload, lifecycle, grid, forecasting",
      "device_id": "device_id this applies to, or omit for org-level",
      "confidence": 0.0-1.0,
      "evidence": ["specific data points that drove this insight"],
      "recommendation": "concrete next action an IT admin can take"
    }
  ]
}

Rules:
- Only report REAL patterns you can ground in the provided context. Use the evidence array to cite the exact numbers that drove your insight.
- Prefer actionable, specific findings over generic advice. Never invent device_ids, fleets, or metrics not present in the data.
- Do not repeat insights that already appear in recent_ai_insights.
- Keep insights to 2-4 per run; only emit a 'critical' severity when the data truly justifies it.
- Return ONLY valid JSON matching the response format.`;

async function runScheduledAnalysis({ force = false } = {}) {
  try {
    state.lastRunAt = new Date().toISOString();
    const context = await buildContext({ pool });

    // Cost control: skip when nothing changed since the last successful run.
    if (!force && state.lastFingerprint && state.lastFingerprint === fingerprint(context)) {
      const reason = 'context unchanged since last run';
      if (!state.lastRunError) state.lastRunError = null;
      return { skipped: true, reason };
    }

    if (!isConfigured()) {
      throw Object.assign(new Error('OPENCODE_API_KEY is not configured'), { code: 'NO_API_KEY' });
    }

    const summary = context.summary || {};
    let insightCount = 0;
    if (context.device_count > 0) {
      const result = await generateStructured(
        SCHEDULED_SYSTEM_PROMPT,
        `Analyze the following EcoTrace telemetry snapshot (JSON) and return insights:\n${JSON.stringify(context)}`
      );
      const { inserted } = await upsertAiAlerts(pool, result?.insights || []);
      insightCount = inserted;
      const expired = await expireAiAlerts(pool);
      if (expired > 0) console.log(`[ai-advisor] Expired ${expired} stale insight(s)`);
    }

    state.lastFingerprint = fingerprint(context);
    state.lastRunSuccess = true;
    state.lastRunError = null;
    state.lastInsightCount = insightCount;
    console.log(
      `[ai-advisor] Scheduled analysis done: ${insightCount} new insight(s) ` +
      `(devices=${context.device_count}, today=${summary.total_today_carbon_g}g, delta=${summary.delta_vs_yesterday_pct ?? 'n/a'}%)`
    );
    return { skipped: false, inserted: insightCount };
  } catch (err) {
    state.lastRunSuccess = false;
    state.lastRunError = (err.code || 'ERR') + ': ' + (err.message || String(err));
    console.error('[ai-advisor] Analysis run failed:', state.lastRunError);
    return { skipped: false, error: state.lastRunError };
  }
}

// ─── Health ──────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'ai-advisor', timestamp: new Date().toISOString() });
});

app.get('/api/ai/status', async (req, res) => {
  try {
    const count = await pool.query(
      `SELECT COUNT(*)::int AS n FROM ai_alerts WHERE status = 'active'`
    );
    res.json({
      configured: isConfigured(),
      model: process.env.OPENCODE_MODEL || 'big-pickle',
      interval_ms: AI_ADVISOR_INTERVAL_MS,
      scheduled_enabled: state.scheduledEnabled,
      last_run_at: state.lastRunAt,
      last_run_success: state.lastRunSuccess,
      last_run_error: state.lastRunError,
      last_insight_count: state.lastInsightCount,
      active_insights: count.rows[0]?.n || 0,
    });
  } catch (err) {
    res.status(500).json({ error: 'status query failed', detail: err.message });
  }
});

// ─── On-demand scheduled-style run (throttled for cost) ─────────────
let lastManualRunAt = null;
app.post('/api/ai/analyze', async (req, res) => {
  const now = Date.now();
  if (lastManualRunAt && now - lastManualRunAt < MANUAL_RUN_COOLDOWN_MS) {
    const waitS = Math.ceil((MANUAL_RUN_COOLDOWN_MS - (now - lastManualRunAt)) / 1000);
    return res.status(429).json({ error: `throttled, retry in ${waitS}s` });
  }
  lastManualRunAt = now;
  const result = await runScheduledAnalysis({ force: true });
  res.status(result.error ? 502 : 200).json(result);
});

// ─── QA dashboard analysis (frontend-supplied structured snapshot) ──
const QA_SYSTEM_PROMPT = `You are a telemetry QA analyst for EcoTrace.
You receive a structured summary of an imported telemetry dataset.
Your job: pinpoint carbon wastage, data-quality problems, and sustainability issues, with concrete evidence and an actionable recommendation for each.

Response format (JSON object):
{
  "findings": [
    {
      "issue": "short title of the data-quality / carbon issue",
      "severity": "critical" | "warning" | "info",
      "evidence": "specific rows/numbers behind the finding",
      "recommendation": "actionable fix",
      "confidence": 0.0-1.0
    }
  ]
}

Rules:
- Ground every finding in the supplied data (quality score, issue codes, per-device/fleet/region totals).
- Do NOT make up metrics.
- Prioritize the most material findings: carbon/energy outliers first, then validation quality.
- Keep findings to 3-5. Return ONLY valid JSON matching the response format.`;

app.post('/api/ai/analyze-qa', async (req, res) => {
  try {
    if (!isConfigured()) {
      return res.status(503).json({ error: 'OPENCODE_API_KEY is not configured' });
    }
    const { structured } = req.body || {};

    const result = await generateStructured(
      QA_SYSTEM_PROMPT,
      `Analyze this telemetry QA dataset summary (JSON):\n${JSON.stringify(structured || {})}`
    );
    res.json({ findings: result?.findings || [] });
  } catch (err) {
    console.error('[ai-advisor] /analyze-qa failed:', err.message);
    res.status(502).json({ error: 'QA analysis failed', detail: err.message });
  }
});

// ─── Startup ────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(`[ai-advisor] HTTP endpoints listening on port ${PORT}`);
  console.log(`[ai-advisor] Zen (big-pickle) configured: ${isConfigured()}`);
  console.log(`[ai-advisor] Scheduled analysis every ${AI_ADVISOR_INTERVAL_MS}ms`);
});

setInterval(() => {
  if (!state.scheduledEnabled) return;
  runScheduledAnalysis().catch((err) =>
    console.error('[ai-advisor] Unhandled scheduler error:', err)
  );
}, AI_ADVISOR_INTERVAL_MS);

// Run once immediately on startup (only succeeds if key is configured).
runScheduledAnalysis()
  .then((r) => console.log('[ai-advisor] Initial run:', r))
  .catch((err) => console.error('[ai-advisor] Initial run failed:', err.message));

process.on('SIGTERM', () => {
  server.close(() => pool.end(() => process.exit(0)));
});