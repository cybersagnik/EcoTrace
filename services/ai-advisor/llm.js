// services/ai-advisor/llm.js
// ─────────────────────────────────────────────────────────────────────
// Thin OpenAI-compatible REST client for OpenCode Zen
// (https://opencode.ai/zen/v1/chat/completions). Reuses the same API key
// that powers the opencode CLI, and the same model ("big-pickle" by
// default).
//
// IMPORTANT: Zen's free tier (which currently includes big-pickle) only
// serves requests bearing official-client identity headers (User-Agent +
// x-opencode-*). Without them it returns MissingSessionID / 429. We inject
// those headers so the advisor can use the same free model as the CLI.
// No SDK dependency — plain fetch (Node 20+).

const OPENCODE_API_KEY = process.env.OPENCODE_API_KEY;
const OPENCODE_MODEL = process.env.OPENCODE_MODEL || 'big-pickle';
const OPENCODE_VERSION = process.env.OPENCODE_VERSION || '1.18.30';
const LLM_TIMEOUT_MS = parseInt(process.env.LLM_TIMEOUT_MS || '90000', 10);

const ENDPOINT = 'https://opencode.ai/zen/v1/chat/completions';

function isConfigured() {
  return Boolean(OPENCODE_API_KEY && !OPENCODE_API_KEY.startsWith('sk-none'));
}

function clientHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${OPENCODE_API_KEY}`,
    'User-Agent': `opencode/${OPENCODE_VERSION} ai-sdk/provider-utils/4.0.23 runtime/bun/1.3.14`,
    'x-opencode-client': 'cli',
    'x-opencode-session': `ses_${randomId()}`,
    'x-opencode-request': `msg_${randomId()}`,
  };
}

function randomId() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function callChat(messages, { jsonMode }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
  try {
    const body = {
      model: OPENCODE_MODEL,
      messages,
      temperature: 0.2,
      stream: false,
    };
    if (jsonMode) body.response_format = { type: 'json_object' };

    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: clientHeaders(),
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      const err = new Error(`Zen HTTP ${res.status}: ${detail.slice(0, 300)}`);
      err.code = 'LLM_HTTP';
      err.status = res.status;
      throw err;
    }

    const json = await res.json();
    const text = json?.choices?.[0]?.message?.content;
    if (!text) {
      const err = new Error('Zen returned no text content');
      err.code = 'LLM_EMPTY';
      throw err;
    }
    return text;
  } catch (err) {
    if (err.name === 'AbortError') {
      const e = new Error(`Zen request timed out after ${LLM_TIMEOUT_MS}ms`);
      e.code = 'LLM_TIMEOUT';
      throw e;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Ask the model for schema-valid JSON.
 * @param {string} systemInstruction  Top-level behavioral instruction.
 * @param {string} userText           Structured data / question payload.
 * @returns {Promise<object>}         Parsed JSON response object.
 */
async function generateStructured(systemInstruction, userText) {
  if (!isConfigured()) {
    const err = new Error('OPENCODE_API_KEY is not configured');
    err.code = 'NO_API_KEY';
    throw err;
  }

  const messages = [
    { role: 'system', content: systemInstruction },
    { role: 'user', content: `${userText}\n\nRespond with valid JSON only, matching the requested schema.` },
  ];

  let text;
  try {
    text = await callChat(messages, { jsonMode: true });
  } catch (err) {
    // Some models reject response_format:json_object — retry without it.
    if (err.status === 400 && /response_format|json/i.test(err.message || '')) {
      text = await callChat(messages, { jsonMode: false });
    } else {
      throw err;
    }
  }

  // Strip markdown fences defensively, then parse.
  const cleaned = text.trim().replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  return JSON.parse(cleaned);
}

module.exports = { generateStructured, isConfigured };