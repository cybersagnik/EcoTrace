# EcoTrace — Enterprise Sustainability Observability Platform

EcoTrace is a **device-level carbon observability platform** for heterogeneous IT fleets. It turns every Linux server, Windows workstation, IoT sensor (and, in future, PLC controller) into a first-class emissions data source — producing per-device, per-service carbon attribution, fleet-level analytics, auditable regulatory reports, and actionable optimization signals in near-real time.

```
DEVICE LAYER          EDGE LAYER          CONTROL PLANE         STREAMING            DATA PLATFORM
┌─────────────┐   ┌──────────────────┐   ┌────────────────┐   ┌──────────────┐   ┌──────────────────────────┐
│ Linux Agent │──▶│ nginx            │──▶│ Auth Service   │──▶│ NATS         │──▶│ Ingestion Workers        │
│ Windows Agt │──▶│ (TLS, JWT, rate)│   │ Registration   │   │ telemetry.raw│   │ Validation / Attribution  │
│ IoT (MQTT)  │──▶│ EMQX Broker     │──▶│ Device Registry│   │              │   │ Aggregation / Storage     │
│ PLC (MQTT)  │   │ (mTLS — future) │   │                │   │              │   │ Dashboards / Reports      │
└─────────────┘   └──────────────────┘   └────────────────┘   └──────────────┘   └──────────────────────────┘
```

---

## Table of Contents

1. [The Market Gap](#the-market-gap)
2. [Solution Architecture](#solution-architecture)
3. [GRC Policies — Governance, Risk, Compliance](#grc-policies)
4. [Security Controls](#security-controls)
5. [Repository Structure](#repository-structure)
6. [Service Stack](#service-stack)
7. [Getting Started](#getting-started)
8. [Documentation](#documentation)

---

## 1. The Market Gap

Emissions disclosure is now a legal requirement, not a best practice. The EU CSRD, the SEC climate disclosure rules, UK SECR, ISO 14064-1 and the GHG Protocol all demand **measured, auditable, attributable emissions** with defensible evidence trails.

Yet the tools most organizations actually use have a structural blind spot:

| Typical sustainability tool | What it cannot do |
| --- | --- |
| Utility-bill / meter-level analytics | Attribute emissions to a *specific workstation, server, or sensor* |
| Manual spreadsheet "carbon calculators" | Provide real-time data, streaming telemetry, or fleet rollups |
| Consulting engagements | Deliver continuous, per-device, audited measurement |
| Cloud-only or datacenter tools | Cover distributed on-prem fleets (laptops, edge servers, shop-floor controllers) |

The result: IT organizations manage **Kilowatt-hours they can invoice** while remaining blind to **the greenhouse-gas cost of the actual devices they run** — and most have zero evidence capability beyond a monthly invoice.

**EcoTrace closes that gap** by treating every device as a measurement endpoint:

- **Per-device carbon accounting** from live telemetry (CPU, memory, network, process/service attribution) — not bill splitting.
- **Heterogeneous fleet coverage** under one contract: Linux servers, Windows workstations today; MQTT IoT/PLC (Tier 2) via the same envelope schema.
- **One shared agent core** so registration, token lifecycle, buffering, and send policies are *identical across every platform by construction* — divergence is made impossible to compile (§2.1).
- **Auditable, signed evidence** (SHA-256-signed PDF, CSV-injection-sanitized exports) for CSRD / ISO 14064-1 / GHG Protocol disclosure.
- **Actionable outcomes**: fleet-level recommendations, budget-position analytics, and consent-gated control-plane notifications pushing optimization to the endpoint.

---

## 2. Solution Architecture

### 2.1 Shared Agent Core — the divergence-proof telemetry client

Every agent — whatever its OS — must run the same five business-logic pieces. EcoTrace packages that logic into a platform-agnostic `core/` library that depends **only on ports (interfaces)**, never on an operating system.

```
                    AGENT CORE — shared library, platform-agnostic
                    ┌─────────────────────────────────────────────┐
                    │  Registration State Machine                  │
                    │  Token Lifecycle Manager (refresh, 401)      │
                    │  TelemetryEnvelope Builder (generated from   │
                    │    schema/telemetry_envelope.proto)          │
                    │  Local Buffer (queue, eviction, backoff)     │
                    │  Send Orchestrator                           │
                    └──────────────┬──────────────────────────────┘
                                   │ depends only on PORTS (interfaces)
                 ┌─────────────────┼──────────────┬──────────────┐
            KeyStore          MetricSource      Transport   NotificationInbox
                 └─────────────────┴──────────────┴──────────────┘
        Linux adapter: TPM2/openssl, /proc, perf, OTLP client
        Windows adapter: CNG/DPAPI, WMI/PDH, OTLP client, tray notifications
```

**Enforcement mechanism — ports:** if a contributor tried to put a Windows registry read inside `core/registration.go`, the Core package would need a Windows-only import — which **fails to compile** for the Linux target. The compiler enforces platform-agnosticism; the fix is structural, not disciplinary.

**Schema source of truth:** `schema/telemetry_envelope.proto` + `auth_claims.proto` generate the Go structs (Tier 1 agents), and will generate the C / Rust types for Tier 2 firmware (PLC / IoT). No consumer ever hand-defines the envelope — so field drift is impossible.

### 2.2 Edge & control plane

| Layer | Components | Responsibility |
| --- | --- | --- |
| Edge | `nginx` (TLS termination, `auth_request`, rate limiting) + OTel Collector path; EMQX broker (Tier 2, future) | Terminates transport, validates identity *before* proxying, applies per-zone rate limits |
| Shared control plane | `auth-service` (JWT issue/verify), `registration-service` (`/register` bootstrap), Device Registry (Postgres) | Identity, registration, device lifecycle, revocation |
| Normalization / streaming | NATS topic `telemetry.raw` (CommonTelemetryEnvelope, schema-version tagged) | Single canonical stream both edges converge on |
| Data platform (core services — never branch on device type) | Ingestion Workers, Validation Engine, Attribution Engine, Aggregation Pipeline, Storage (MVs + daily summaries), Dashboard | Schema/range/authorization validation, emission-factor calculation (grid intensity), periodic rollups, per-service attribution |

**Protocol flows:**
- Tier 1 (Linux / Windows) → `OTLP/HTTP + JWT` → nginx → OTel Collector → NATS `telemetry.raw`
- Tier 2 (IoT / PLC, future) → `MQTT + mTLS` → EMQX → NATS `telemetry.raw`
- Both paths converge on **the same envelope shape**, so Core Services never branch on device class.

### 2.3 Attribution pipeline (emissions → insight)

```
envelope (cpu/mem/net/process_count/processes[]/load_avg)
   → validation (schema + range + device authorization)
   → attribution engine: energy = f(rated power, utilization); 70% CPU / 30% RSS split
        per process → emissions_by_service
   → rollups: emissions_raw → emissions_calculated → daily_summaries (materialized)
   → surfaced by: /api/analytics (fleet & device drill-downs), /api/alerts,
        AI advisor (scheduled LLM insight generation), /api/reports (CSV+PDF)
```

---

## 3. GRC Policies

EcoTrace applies **Governance, Risk, and Compliance** controls as code and as process.

### 3.1 Governance

| Policy | Implementation |
| --- | --- |
| Change control | Versioned DB migrations (`infra/db/migrations/00X_*.sql`), applied in order; schema changes originate in `.proto` and are regenerated to every consumer together |
| Design rules | `core/` must stay platform-agnostic; adapters must contain **no business logic** (no state machines, retry policy, or scheduling); new device classes never introduce new Data Platform paths |
| Auditability | Every lifecycle event is written to `audit_log` (registration, fleet create/assign/delete, notification send, device revocation) with device + metadata |
| Access governance | JWT device claims authorize API scope; admin actions require the separate `ADMIN_TOKEN`; agent-only endpoints verify the caller's own `device_id` |
| Duty separation | Bootstrap tokens and admin tokens are separate secrets; issuance (`registration-service`) is separated from verification (`auth-service`) |

### 3.2 Risk

| Risk | Control |
| --- | --- |
| Rogue device registration | One-time bootstrap tokens; registration accepts only known device classes (`linux`, `windows`, `iot`, `plc`) |
| Compromised device identity | `/admin/revoke/:device_id`; revoked devices are excluded from fleet views and API responses; hardware-backed keystore preferred |
| Data loss on network failure | Local buffer with oldest-first eviction, exponential backoff, no tight retry loops; buffer is serialized and persisted across restarts |
| Key / secret exposure | Secrets live only in gitignored `.env`; container env-injection; key material on agents at `0600` and preferentially in TPM/CNG hardware |
| Unauthorized notification spam | Explicit per-device `notification_consent` (default **off**), daily dedupe keys (`reco-{device}-{date}` → HTTP 409), audit `notification.sent` |
| Stale AI insights | AI alerts expire after 48 h; feed caps at top-5 by confidence; every insight is confidence-scored and referenced to live context |
| Rate / resource abuse | nginx rate-limit zones (API 30 r/m, register 5 r/m) with burst allowance |

### 3.3 Compliance

| Framework intent | EcoTrace mapping |
| --- | --- |
| GHG Protocol / ISO 14064-1 evidence | Signed PDF reports (SHA-256) + sanitized CSV exports from validated `emissions_calculated` data; per-service attribution for accurate Scope-2 downstream allocation |
| CSRD / SECR / SEC disclosure workflows | Fleet-level rollups with grid-region intensity, "Unassigned" bucket accounting, daily summaries and budget-position analytics |
| Data minimization & consent | Consent is per-device, explicit, audited and revocable; notification channel and poll interval are clamped at registration |
| Personal-data hygiene | Device identity is deriveable/revocable; telemetry is device-class telemetry, not user biometric/personal data; no PII is collected beyond an ops hostname |
| Secure software lifecycle | Healthchecked services, linted/orchard TypeScript builds (`tsc` + `next lint` gate), documented OWASP Top 10 / ASVS assessment (see `frontend/README.md`) |

> The detailed **OWASP Top 10 (2021) / API Security Top 10 (2023) / ASVS v4 / NIST SP 800-53 / CWE Top 25** severity assessment matrix lives in [`frontend/README.md`](frontend/README.md).

---

## 4. Security Controls

### 4.1 Transport & edge (nginx)
- TLS 1.2/1.3 only, strong cipher suite (`HIGH:!aNULL:!MD5:!RC4`), self-signed certs for dev / real CA for production
- Security headers on every response: `Strict-Transport-Security`, `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`
- Only nginx exposes host ports (80/443); NATS, Postgres, auth, and internal services are **never** host-exposed
- `auth_request` subrequest to `auth-service` verifies every protected request **before** proxying; verified device claims are injected as `X-Device-ID` / `X-Device-Class`

### 4.2 Authentication & authorization
- **JWT** (HS256, `JWT_SECRET` env-injected, 60-minute expiry) with out-of-band refresh; 401 responses trigger immediate, monitored refresh
- Admin login accepts only the `ADMIN_TOKEN` secret, not the device pool; admin revocation endpoint is locked behind the separate admin token header
- API routes are JWT-gated (`verifyJWT`) and agent-only routes assert `req.deviceId` ownership before reading/mutating notifications
- Database credentials are scoped per-service from `.env` (`POSTGRES_PASSWORD`), Postgres not exposed to the host

### 4.3 Registration & device lifecycle
- `/register` authenticates via a shared bootstrap token; response mints per-device credentials; `notification_poll_interval_s` is clamped (≥ 5 s) to prevent polling abuse
- Device keys: Linux prefers TPM2 (`tpm2_create`) over `openssl genpkey` with `0600` file-permission fallback; Windows prefers TPM-backed CNG over DPAPI-wrapped blobs; signing and private keys never leave the keystore adapter
- Revocation is immediate and API-wide: `/admin/revoke/:device_id` forces exclusion from fleet views and device lists

### 4.4 Data & report hardening
- **CSV injection resistance**: export fields beginning with `=`, `+`, `-`, `@` are neutralized before serialization
- **PDF integrity**: server-side `pdfkit` reports include live totals plus an embedded SHA-256 signature for tamper-evidence
- Input validation: malformed payloads return `400`; duplicate fleet names / notification today-dedupes return `409`; non-consenting notification sends are rejected `409`
- Session handling: the frontend `fetcher` intercepts `401` → clears the session and redirects to login, so stale JWTs cannot silently accumulate in the UI

### 4.5 Operational security
- All containers run with healthchecks (`/health` endpoints, `pg_isready`, W3C OTLP probe); the ingress is the single TLS surface
- `.env` / `infra/.env` are gitignored; the repository contains **no** production secrets — only environment references (`${VAR}`) and documented dev defaults
- AI advisor receives **no raw credentials**; it reads only a curated context snapshot and never stores tokens

---

## 5. Repository Structure

```
EcoTrace/
├── agent/                  Tier 1 agents
│   ├── core/               platform-agnostic business logic (registration,
│   │                       token lifecycle, envelope builder, buffer, orchestrator, ports)
│   ├── schema/             telemetry_envelope.proto + auth_claims.proto (source of truth)
│   ├── adapter/linux/      KeyStore (TPM2/openssl), MetricSource (/proc, perf), Transport
│   ├── adapter/windows/    KeyStore (CNG/DPAPI), MetricSource (WMI/PDH), Transport, inbox/tray
│   ├── transport/otlp/     shared OTLP/HTTP client
│   ├── agent               Linux worker binary
│   ├── agent.exe           Windows worker binary
│   └── start_windows_agent.ps1    real-host launcher
├── services/
│   ├── api/                REST API (devices, fleet, analytics, reports, alerts,
│   │                       notifications, settings, admin/revoke) + /api/alerts AI merge
│   ├── auth-service/       JWT issue/verify
│   ├── registration-service/  /register bootstrap
│   ├── ingestion-http/     OTel collector → NATS
│   ├── ingestion-worker/   NATS consumer → attribution
│   ├── attribution-engine/ emission-factor calculation, per-service split
│   ├── ai-advisor/         scheduled LLM insight generation (OpenCode Zen / big-pickle)
│   └── websocket/          live NATS events → browser
├── infra/
│   ├── docker-compose.yml  full stack orchestration
│   ├── nginx/nginx.conf    TLS, auth_request, rate limits, headers, /api/ai/ proxy
│   ├── certs/              dev TLS material
│   ├── db/migrations/      00X_*.sql versioned schema
│   └── systemd/            host deployment units
├── frontend/               Next.js 14 (App Router) + TypeScript + Tailwind dashboard
│   └── README.md           design system + OWASP/ASVS/NIST security assessment matrix
├── deploy.sh               build → preflight → bring-up automation
├── CONTEXT.md              architecture + environment + runbook (single source of truth)
└── .env                    gitignored secrets (POSTGRES_PASSWORD, JWT_SECRET,
                            BOOTSTRAP_TOKEN, ADMIN_TOKEN, OPENCODE_API_KEY)
```

---

## 6. Service Stack

| Container | Role | Port (internal) | Healthcheck |
| --- | --- | --- | --- |
| `nginx` | TLS edge / auth_request / rate limit | 80, 443 (host) | `curl -fsSk https://127.0.0.1/nginx-health` |
| `frontend` | Next.js dashboard | 3000 | Next.js internal |
| `api` | REST API + reports + notifications | 3003 | `wget --spider :3003/health` |
| `auth-service` | JWT verify | 3001 | `wget --spider :3001/health` |
| `registration-service` | `/register` bootstrap | 3002 | `wget --spider :3002/health` |
| `ingestion-http` | OTLP receiver | 4318 | W3C OTLP probe |
| `ingestion-worker` | NATS consumer → attribution | 3003 (not exposed) | node process |
| `attribution-engine` | carbon calculation | 3004 | JSON health grep |
| `ai-advisor` | scheduled AI insights | 3005 | health grep |
| `websocket` | NATS → browser | 3010 (not exposed) | node process |
| `nats` | message bus (`telemetry.raw`) | 4222 (not exposed) | `nats:2.10-alpine` |
| `postgres` | storage (devices, emissions, fleets, ai_alerts, audit_log, settings) | 5432 (not exposed) | `pg_isready` |

---

## 7. Getting Started

**Prerequisites:** Go 1.22 (agents), Node 20 (services/frontend), Docker Compose v2, cloudflared *or* a tunnel/CA path to the edge.

### 7.1 Bring up the platform

```bash
# 1. Secrets — set in .env and infra/.env (both gitignored, keep in sync):
#    POSTGRES_PASSWORD, JWT_SECRET, BOOTSTRAP_TOKEN, ADMIN_TOKEN,
#    OPENCODE_API_KEY (AI advisor), TUNNEL_PUBLIC_URL / CORS_ALLOWED_ORIGINS

cd infra && docker compose up -d && docker compose ps   # all containers healthy

# After any backend/frontend rebuild, always restart the edge (Docker DNS cache):
docker compose restart nginx
```

### 7.2 Run the Linux agent (WSL / server)

```bash
cd /mnt/d/EcoTrace
nohup env ECOTRACE_SERVER=https://<host> \
  ECOTRACE_INSECURE_TLS=true \
  BOOTSTRAP_TOKEN=<from .env> \
  DEVICE_CLASS=linux \
  AGENT_INTERVAL=30s \
  ./agent/agent >/tmp/ecotrace-agent.log 2>&1 < /dev/null &
```

### 7.3 Run the Windows agent (real Windows host)

```powershell
# Edit agent/start_windows_agent.ps1 → $env:ECOTRACE_SERVER, then:
powershell -NoProfile -ExecutionPolicy Bypass -File D:\EcoTrace\agent\start_windows_agent.ps1
```

### 7.4 Verify

```bash
curl -k -sS -X POST https://<host>/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"device_id":"admin@ecotrace.io","secret":"x","device_class":"admin"}'
# → access_token → GET /api/devices shows operating endpoints, /api/fleet rollups,
#   /api/analytics drill-downs, /api/alerts (rules + AI), /api/reports (CSV/PDF)
```

---

## 8. Documentation

- [`CONTEXT.md`](CONTEXT.md) — finalized architecture, implementation state, environment access, and resume runbook (single source of truth for the codebase).
- [`frontend/README.md`](frontend/README.md) — design system tokens + full OWASP Top 10 / API Top 10 / ASVS v4 / NIST SP 800-53 / CWE-25 security assessment matrix and severity/remediation SLA policy.

---

*EcoTrace — measured, attributable, auditable device-level carbon observability.*