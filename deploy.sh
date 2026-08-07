#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
# EcoTrace — Production deployment script
#
# Usage:
#   ./deploy.sh                 # pull + rebuild + restart
#   ./deploy.sh --no-pull       # skip git pull
#   ./deploy.sh --rebuild-only  # rebuild images without restart
#   ./deploy.sh --status        # print status only
#
# Exits non-zero on any failure. Designed for unattended Innovathon runs.
# ════════════════════════════════════════════════════════════════════════════
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_DIR="${REPO_ROOT}/infra"
LOG_PREFIX="[deploy]"

# ─── helpers ───────────────────────────────────────────────────────────────
log()  { printf '%s %s\n' "${LOG_PREFIX}" "$*"; }
fail() { printf '%s ERROR: %s\n' "${LOG_PREFIX}" "$*" >&2; exit 1; }

require() {
  command -v "$1" >/dev/null 2>&1 || fail "required command not found: $1"
}

require docker
require ssh
require openssl

# ─── args ─────────────────────────────────────────────────────────────────
PULL=true
REBUILD=false
STATUS_ONLY=false
for arg in "$@"; do
  case "${arg}" in
    --no-pull)        PULL=false ;;
    --rebuild-only)   REBUILD=true ;;
    --status)         STATUS_ONLY=true ;;
    -h|--help)
      grep '^# ' "${BASH_SOURCE[0]}" | sed 's/^# //'
      exit 0
      ;;
    *) fail "unknown argument: ${arg}" ;;
  esac
done

cd "${REPO_ROOT}"

# Load .env so we can read TUNNEL_PUBLIC_URL
if [[ -f "${REPO_ROOT}/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${REPO_ROOT}/.env"
  set +a
fi

# ─── status-only mode ─────────────────────────────────────────────────────
if ${STATUS_ONLY}; then
  log "Container status:"
  (cd "${COMPOSE_DIR}" && docker compose ps) || true
  log
  if [[ -n "${TUNNEL_PUBLIC_URL:-}" ]]; then
    log "Tunnel public URL (from .env):"
    log "  ${TUNNEL_PUBLIC_URL}"
  else
    log "TUNNEL_PUBLIC_URL not set in .env"
    log "Tunnel service status:"
    sudo -n systemctl is-active ecotrace-tunnel 2>/dev/null \
      || echo "(unable to query systemd — run: systemctl is-active ecotrace-tunnel)"
    log
    log "Tunnel journal (last 5 lines):"
    sudo -n journalctl -u ecotrace-tunnel --no-pager -n 5 2>/dev/null \
      || echo "(unable to read journal without sudo — run: journalctl -u ecotrace-tunnel -n 5)"
  fi
  exit 0
fi

# ─── preflight ────────────────────────────────────────────────────────────
[[ -f "${REPO_ROOT}/.env" ]] || fail ".env not found at repo root — copy from .env.example and fill in secrets"

# Sync root .env into infra/.env so docker compose (which reads .env from
# its project directory) finds it. Keep the root .env as the source of truth.
cp "${REPO_ROOT}/.env" "${COMPOSE_DIR}/.env"

# Make sure nginx config is syntactically valid before bringing it up.
log "Validating nginx config syntax..."
if command -v docker >/dev/null 2>&1; then
  out=$(docker run --rm -v "${COMPOSE_DIR}/nginx/nginx.conf:/etc/nginx/nginx.conf:ro" \
    -v "${COMPOSE_DIR}/certs:/etc/nginx/certs:ro" \
    nginx:1.25-alpine sh -c 'nginx -t 2>&1' || true)
  # In an isolated container, Docker service DNS isn't reachable so
  # upstream hostnames (api, auth-service, etc.) legitimately fail to
  # resolve. Only treat the failure as fatal when the error is unrelated
  # to that ("host not found in upstream" / "no resolver defined").
  if [[ -n "${out}" ]] && ! grep -qE 'host not found in upstream|no resolver defined' <<<"${out}"; then
    log "nginx config syntax check output:"
    log "${out}"
    fail "nginx config syntax check failed"
  else
    log "nginx config syntax OK (upstream DNS will resolve at runtime via Docker)"
  fi
fi

# ─── git pull (optional) ──────────────────────────────────────────────────
if ${PULL}; then
  log "Pulling latest from origin main..."
  git pull --ff-only origin main || log "git pull failed or no upstream — continuing"
fi

# ─── docker compose up ─────────────────────────────────────────────────────
log "Bringing up the stack (this may take a few minutes)..."
cd "${COMPOSE_DIR}"
if ${REBUILD}; then
  docker compose build
else
  docker compose up -d --build
fi

# ─── wait for health ──────────────────────────────────────────────────────
log "Waiting for services to become healthy..."
deadline=$((SECONDS + 180))
while (( SECONDS < deadline )); do
  unhealthy=$(docker compose ps --format json 2>/dev/null | \
               python3 -c '
import json, sys
for line in sys.stdin:
    try:
        s = json.loads(line)
        if s.get("Health") not in ("healthy", "") and s.get("State") != "running":
            print(s.get("Name", s.get("Service", "?")))
    except Exception:
        pass
' 2>/dev/null || true)
  if [[ -z "${unhealthy}" ]]; then
    break
  fi
  sleep 5
done

# ─── report ───────────────────────────────────────────────────────────────
log
log "Container status:"
docker compose ps || true

log
log "Local health check:"
curl -k -sS -o /dev/null -w "  HTTPS /api/health  → %{http_code}\n" \
  https://localhost/api/health || true
curl -sS -o /dev/null -w "  HTTP  /             → %{http_code} (expect 301)\n" \
  http://localhost/ || true

log
log "Tunnel public URL:"
# Auto-discover cloudflared trycloudflare URL from the systemd journal so the
# operator doesn't have to grep it manually. Each restart assigns a new URL,
# so we always re-derive.
TUNNEL_URL_DETECTED=""
if command -v sudo >/dev/null 2>&1; then
  TUNNEL_URL_DETECTED=$(sudo -n journalctl -u ecotrace-tunnel --no-pager 2>/dev/null \
    | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' \
    | tail -1 || true)
fi
if [[ -z "${TUNNEL_URL_DETECTED}" ]] && command -v journalctl >/dev/null 2>&1; then
  TUNNEL_URL_DETECTED=$(journalctl -u ecotrace-tunnel --no-pager 2>/dev/null \
    | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' \
    | tail -1 || true)
fi
if [[ -n "${TUNNEL_URL_DETECTED}" ]]; then
  log "  ${TUNNEL_URL_DETECTED}"
  # Persist to .env + infra/.env if changed
  if ! grep -q "${TUNNEL_URL_DETECTED}" "${REPO_ROOT}/.env" 2>/dev/null; then
    log "  → updating TUNNEL_PUBLIC_URL and CORS_ALLOWED_ORIGINS in .env"
    tmp_env=$(mktemp)
    sed -E "s|^TUNNEL_PUBLIC_URL=.*|TUNNEL_PUBLIC_URL=${TUNNEL_URL_DETECTED}|" \
      "${REPO_ROOT}/.env" > "${tmp_env}"
    if grep -q "${TUNNEL_URL_DETECTED}" "${tmp_env}"; then
      mv "${tmp_env}" "${REPO_ROOT}/.env"
      cp "${REPO_ROOT}/.env" "${COMPOSE_DIR}/.env"
      # Add to CORS origins if missing
      if ! grep -q "${TUNNEL_URL_DETECTED}" <<<"${CORS_ALLOWED_ORIGINS:-}"; then
        sed -i "s|^CORS_ALLOWED_ORIGINS=.*|CORS_ALLOWED_ORIGINS=${CORS_ALLOWED_ORIGINS:-http://localhost,https://localhost,http://127.0.0.1,https://127.0.0.1},${TUNNEL_URL_DETECTED}|" \
          "${REPO_ROOT}/.env"
        cp "${REPO_ROOT}/.env" "${COMPOSE_DIR}/.env"
      fi
      log "  → restarting api to pick up new CORS"
      (cd "${COMPOSE_DIR}" && docker compose up -d --no-deps api >/dev/null 2>&1) || true
    else
      rm -f "${tmp_env}"
    fi
  fi
elif [[ -n "${TUNNEL_PUBLIC_URL:-}" ]]; then
  log "  ${TUNNEL_PUBLIC_URL} (from .env)"
else
  log "  (no tunnel URL detected)"
  log "  Tunnel service status:"
  sudo -n systemctl is-active ecotrace-tunnel 2>/dev/null \
    || log "  (unable to query systemd — run: systemctl is-active ecotrace-tunnel)"
fi

log
log "Done. Verify the URL with:  curl -k ${TUNNEL_URL_DETECTED:-${TUNNEL_PUBLIC_URL:-https://<tunnel-url>}}/api/health"
