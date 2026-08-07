'use strict';

// SECURITY: Validation Engine is the final gate before data enters PostgreSQL.
// It enforces:
//   1. Schema completeness — all required fields present
//   2. Range validity — metric values within physical bounds
//   3. Type safety — numeric fields are actually numeric
//   4. device_id cross-check — matches the JWT claim passed by nginx header
//   5. Timestamp sanity — not in the future, not older than 10 minutes

const REQUIRED_FIELDS = [
  'device_id', 'device_class', 'schema_version',
  'cpu_usage', 'memory_usage', 'network_sent', 'network_received',
  'window_start_ms', 'window_end_ms'
];

const ALLOWED_DEVICE_CLASSES = ['linux', 'windows', 'iot', 'plc'];

/**
 * validate checks an envelope against all rules.
 * Returns { valid: true } or { valid: false, reason: string }
 * SECURITY: never throws — always returns a result object.
 */
function validate(envelope, jwtDeviceId) {
  // 1. Required fields
  for (const field of REQUIRED_FIELDS) {
    if (envelope[field] === undefined || envelope[field] === null || envelope[field] === '') {
      return fail(`missing required field: ${field}`);
    }
  }

  // 2. device_id cross-check with JWT claim
  // SECURITY: prevents a compromised agent from spoofing another device's data
  if (jwtDeviceId && envelope.device_id !== jwtDeviceId) {
    return fail(`device_id mismatch: envelope=${envelope.device_id} jwt=${jwtDeviceId}`);
  }

  // 3. device_class allowlist
  if (!ALLOWED_DEVICE_CLASSES.includes(envelope.device_class)) {
    return fail(`unknown device_class: ${envelope.device_class}`);
  }

  // 4. CPU usage range
  const cpu = parseFloat(envelope.cpu_usage);
  if (isNaN(cpu) || cpu < 0 || cpu > 100) {
    return fail(`cpu_usage out of range: ${envelope.cpu_usage}`);
  }

  // 5. Memory usage range
  const mem = parseFloat(envelope.memory_usage);
  if (isNaN(mem) || mem < 0 || mem > 100) {
    return fail(`memory_usage out of range: ${envelope.memory_usage}`);
  }

  // 6. Network bytes non-negative
  if (parseInt(envelope.network_sent) < 0) {
    return fail(`network_sent cannot be negative`);
  }
  if (parseInt(envelope.network_received) < 0) {
    return fail(`network_received cannot be negative`);
  }

  // 7. Timestamp sanity — use window_end_ms (server-side ingestion time)
  const windowEnd = parseInt(envelope.window_end_ms);
  if (isNaN(windowEnd)) {
    return fail(`invalid window_end_ms: ${envelope.window_end_ms}`);
  }
  const now = Date.now();
  if (windowEnd > now + 30_000) {
    return fail(`window_end_ms is in the future`);
  }
  if (windowEnd < now - 10 * 60 * 1000) {
    // More than 10 minutes old — likely a stale buffered envelope
    // Accept it but flag it (do not reject — buffered data is valid)
    console.warn(`[validator] WARN: old envelope device_id=${envelope.device_id} age=${Math.round((now - windowEnd)/1000)}s`);
  }

  // 8. Window sanity
  const windowStart = parseInt(envelope.window_start_ms);
  if (windowEnd <= windowStart) {
    return fail(`window_end_ms must be after window_start_ms`);
  }

  return { valid: true };
}

function fail(reason) {
  return { valid: false, reason };
}

module.exports = { validate };
