# EcoTrace — Context, Current State, and Next Task

> **Document purpose:** Single source of truth for resuming EcoTrace work in a new session. Contains the finalized architecture, what's been built and verified so far, and the precise next task to execute.

---

## Table of Contents

1. [Platform Architecture](#1-platform-architecture)
2. [The Sharing Problem](#2-the-sharing-problem)
3. [Shared Agent Core — Overview](#3-shared-agent-core--overview)
4. [Shared Agent Core — Component Detail](#4-shared-agent-core--component-detail)
5. [Ports — The Enforcement Mechanism](#5-ports--the-enforcement-mechanism)
6. [Platform Adapters](#6-platform-adapters)
7. [Tier 2 — Schema Contract for Constrained Devices](#7-tier-2--schema-contract-for-constrained-devices)
8. [Repository Structure](#8-repository-structure)
9. [Workflows](#9-workflows)
10. [Design Rules — What Must Never Be Violated](#10-design-rules--what-must-never-be-violated)
11. [Current Implementation State](#11-current-implementation-state)
12. [Active Workflow — Telemetry → Dashboard](#12-active-workflow--telemetry--dashboard)
13. [Environment & Access](#13-environment--access)
14. [What's Done This Session](#14-whats-done-this-session)
15. [Known Issues / Mock Data Still Present](#15-known-issues--mock-data-still-present)
16. [Completed Previously — Device Categorization](#16-completed-previously--device-categorization-endpoints--iot--fleets--plc)
17. [Next Task — TBD](#17-next-task--tbd)

---

## 1. Platform Architecture

```
DEVICE LAYER
├── Linux Server Agent          (systemd service — ACTIVE)
├── Windows Workstation Agent   (Windows Service — ACTIVE)
├── IoT Agent                   (MQTT + mTLS — FUTURE)
└── PLC Plugin                  (MQTT + mTLS — FUTURE)

EDGE LAYER
├── OTLP PATH  →  nginx (TLS termination, rate limiting, auth_request)
│                  └── OTel Collector (OTLP receiver, batch processor, Kafka exporter)
└── MQTT PATH  →  EMQX Broker (mTLS authentication, Topic ACLs)

SHARED CONTROL PLANE
├── Auth Service        (JWT verify + cert verify)
├── Registration Service(/register — bootstrap token / /provision — bench cert)
└── Device Registry     (device_id, device_class, public_key/cert_fp, status)

NORMALIZATION / STREAMING LAYER
└── Kafka / NATS  →  topic: telemetry.raw  (Common TelemetryEnvelope, schema_version tagged)

DATA PLATFORM — CORE SERVICES (never change per device class)
├── Ingestion Workers     (consumer group, scalable)
├── Validation Engine     (schema + range + authorization)
├── Attribution Engine    (emission factor calculation)
├── Aggregation Pipeline  (periodic rollups)
├── Storage               (emissions_raw, emissions_calculated, daily_summaries, Materialized View)
└── EcoTrace Dashboard
```

**Protocol flows:**
- Linux/Windows agents → `OTLP/HTTP + JWT` → nginx → OTel Collector
- IoT/PLC agents → `MQTT + mTLS` → EMQX Broker → rule engine bridge → streaming layer
- Both edges converge on `telemetry.raw` in the same `CommonTelemetryEnvelope`

---

## 2. The Sharing Problem

Every agent — regardless of platform — must perform the same five pieces of business logic:

| Responsibility | Why It Must Behave Identically Everywhere |
|---|---|
| Registration flow | Inconsistent registration produces inconsistent Device Registry rows and breaks the "one Auth Service, two edges" guarantee |
| Token lifecycle (refresh, 401 handling) | Divergent refresh timing creates inconsistent load on Auth Service and inconsistent field failure behavior |
| TelemetryEnvelope construction | Independent hand-built envelopes cause silent field name/type drift over time |
| Local buffering, eviction, backoff | Inconsistent buffering means inconsistent data-loss behavior under network failure |
| Send orchestration | Flush timing, batching, and backoff must be one policy — not N independently-tuned policies |

**The fix is not "be more disciplined."** The fix is to make divergence impossible to compile, not just unlikely.

---

## 3. Shared Agent Core — Overview

```
                    AGENT CORE — shared library, platform-agnostic
                    ┌─────────────────────────────────────────────┐
                    │  Registration State Machine                  │
                    │  Token Lifecycle Manager (refresh, 401)      │
                    │  TelemetryEnvelope Builder (generated)       │
                    │  Local Buffer (queue, eviction, backoff)     │
                    │  Send Orchestrator                           │
                    └──────────────┬──────────────────────────────┘
                                   │ depends only on PORTS (interfaces)
              ┌────────────────────┼────────────────────┐
              │                    │                    │
         KeyStore             MetricSource          Transport
          (interface)          (interface)          (interface)
              │                    │                    │
    ┌─────────┴──────┐   ┌────────┴────────┐   ┌──────┴──────┐
    │ Linux Adapter  │   │ Windows Adapter │   │ Shared OTLP │
    │ tpm2/openssl   │   │ CNG / DPAPI     │   │ HTTP client │
    │ /proc, perf    │   │ WMI / PDH       │   └─────────────┘
    └────────────────┘   └─────────────────┘

SCHEMA SOURCE OF TRUTH
└── telemetry_envelope.proto + auth_claims.proto
    ├── protoc → Go struct  (Tier 1 — Linux/Windows Agent Core)
    ├── protoc → C header   (Tier 2 — PLC firmware)
    └── protoc → Rust struct(Tier 2 — IoT agent, e.g. ESP32-class)
```

**Governing principle:** The Agent Core has zero knowledge of any operating system. It is pure business logic — state machines, scheduling, validation, queueing — written once. The compiler refuses to build a platform target unless its adapter fully satisfies every port.

---

## 4. Shared Agent Core — Component Detail

### 4.1 Registration State Machine

**States:**
```
UNREGISTERED → REGISTERING → REGISTERED → OPERATING
                    │
                    └─→ REGISTRATION_FAILED (terminal — requires new bootstrap token)
```

**Responsibilities:**
- On startup, check local storage (via `KeyStore` port) for existing credentials → if valid, skip to `OPERATING`
- If absent, generate a keypair via `KeyStore.GeneratePrivateKey()` and call `/register`
- Parse response, persist `device_id` + tokens via `KeyStore.SaveCredentials()`
- On failure (expired/consumed bootstrap token) → transition to `REGISTRATION_FAILED` and emit a clear local log entry (human-actionable, not auto-retried)

> Only the two `KeyStore` port calls are platform-specific. All state transitions, the HTTP call, and response parsing live entirely in Core.

### 4.2 Token Lifecycle Manager

- Track `issued_at` and `expires_at` for the current `access_token`
- Schedule refresh at a fixed margin before expiry (e.g. 45 min into a 60-min lifetime)
- On a `401` response from ANY send attempt → immediately trigger out-of-cycle refresh
- On refresh failure (refresh_token itself rejected) → transition Registration State Machine back to `REGISTRATION_FAILED`; agent halts and does not silently re-register

### 4.3 TelemetryEnvelope Builder

- Accept raw metric readings from `MetricSource.Collect()` and assemble into canonical envelope shape
- Auto-stamp `schema_version`, `device_id`, `device_class`, and `timestamp_window` — adapters never set these fields
- Validate the assembled envelope against the schema before handing to the buffer

### 4.4 Local Buffer

- Queue constructed envelopes pending successful transmission
- Enforce maximum buffer size (time-bounded, e.g. 24 hours of windows) with oldest-first eviction when cap is exceeded
- Persist buffer across agent restarts (Core owns the serialization format; adapter handles the filesystem access via `KeyStore`)

### 4.5 Send Orchestrator

- Decide WHEN to flush: on timer, on buffer-size threshold, or immediately for high-priority events
- Batch multiple envelopes into a single `Transport.Send()` call where supported
- Apply exponential backoff on send failure with a defined max retry count; on exhaustion, leave data in buffer for next scheduled attempt (no tight retry loops)
- Attach current `access_token` by reading from Token Lifecycle Manager

---

## 5. Ports — The Enforcement Mechanism

```go
// core/ports.go — lives entirely inside the platform-agnostic Core

type KeyStore interface {
    GeneratePrivateKey() (publicKey []byte, err error)
    Sign(data []byte) (signature []byte, err error)
    LoadStoredCredentials() (Credentials, error)
    SaveCredentials(Credentials) error
}

type MetricSource interface {
    Collect(window TimeRange) ([]Metric, error)
}

type Transport interface {
    Send(envelope TelemetryEnvelope) error
}
```

**Why this is the actual fix:** If a contributor adds a Windows-specific registry read inside `core/registration.go`, the Core package would need to import a Windows-only library — which **fails to compile** when cross-compiling the Linux target.

---

## 6. Platform Adapters

| Port Method | Linux Adapter | Windows Adapter |
|---|---|---|
| `KeyStore.GeneratePrivateKey()` | `tpm2_create` if TPM present, else `openssl genpkey` + file at `0600` | `NCryptCreatePersistedKey` (TPM-backed CNG), else DPAPI-encrypted blob |
| `KeyStore.Sign()` | TPM signing or local private key sign | CNG sign or DPAPI-unwrapped key sign |
| `MetricSource.Collect()` | Reads `/proc`, `perf_event` for CPU/process stats | WMI / PDH (Performance Data Helper) queries |
| `Transport.Send()` | OTLP/HTTP client (shared Go library) | Same shared OTLP/HTTP client |

> **Note on Transport:** Both Linux and Windows use the same `transport/otlp` package. `Transport` is a port only to keep the door open for a future platform requiring a genuinely different transport.

---

## 7. Tier 2 — Schema Contract for Constrained Devices

IoT sensors and PLC controllers cannot run the compiled Agent Core. Tier 2 shares **the schema, not the code**.

```
schema/
├── telemetry_envelope.proto  ← single source of truth for ALL device classes (Tier 1 + Tier 2)
└── auth_claims.proto         ← shared JWT claim shape (used by Tier 1 Token Lifecycle Manager)

protoc generates:
├── Go struct   → Agent Core (Tier 1 — Linux/Windows)
├── C header    → PLC firmware (Tier 2 — hand-written logic, generated types only)
└── Rust struct → IoT agent (Tier 2 — ESP32-class microcontroller)
```

**Auth difference:** Tier 2 devices authenticate via a pre-burned mTLS certificate (the TLS library does almost all the work) rather than implementing the Tier 1 registration/refresh state machine.

---

## 8. Repository Structure

```
/ecotrace-agent
├── /schema
│   ├── telemetry_envelope.proto    ← Tier 1 + Tier 2 source of truth
│   └── auth_claims.proto
│
├── /core                           ← platform-agnostic, ~80% of agent logic
│   ├── registration.go             Registration State Machine
│   ├── token_lifecycle.go          Token Lifecycle Manager
│   ├── envelope.go                 TelemetryEnvelope Builder
│   ├── buffer.go                   Local Buffer
│   ├── send_orchestrator.go        Send Orchestrator
│   └── ports.go                    KeyStore / MetricSource / Transport
│
├── /transport/otlp
│   └── client.go                   ← shared OTLP/HTTP client (used by both adapters)
│
├── /adapter/linux
│   ├── keystore_linux.go           implements KeyStore
│   ├── metrics_linux.go            implements MetricSource
│   └── transport_linux.go          wires transport/otlp for Linux
│
├── /adapter/windows
│   ├── keystore_windows.go         implements KeyStore
│   ├── metrics_windows.go          implements Windows MetricSource
│   └── transport_windows.go        wires transport/otlp for Windows
│
├── /firmware-contracts             ← Tier 2 — NOT shared compiled code
│   ├── /generated/c                protoc-generated C headers for PLC
│   ├── /generated/rust             protoc-generated Rust types for IoT
│   └── README.md                   integration notes for firmware teams
│
└── main.go                         ← wires Core + correct adapter at compile time (per GOOS)
```

**Build targets:**
```bash
go build                        # Linux target: core/ + adapter/linux/
GOOS=windows go build           # Windows target: core/ + adapter/windows/
```

The same `core/` package ships unmodified in both binaries.

---

## 9. Workflows

### 9.1 Adding a New Tier 1 Platform (e.g. macOS, general-purpose edge gateway)

1. Confirm target can run a Go binary and has OS-level secure key storage (e.g. Keychain on macOS)
2. Create `/adapter/macos/` implementing `KeyStore` and `MetricSource`
3. `Transport` is likely free — reuse `transport/otlp` directly
4. **No changes to `/core`**. No schema changes unless this platform needs a genuinely new `metric_type`
5. If schema change is needed: update `.proto`, regenerate all consumers (Core + all Tier 2 headers) together — never independently
6. Build with `GOOS=darwin`, ship

### 9.2 Adding a New Tier 2 Device Class (e.g. new sensor type)

1. Determine `metric_types` needed. If already in `telemetry_envelope.proto` → skip to step 3
2. If new `metric_types` needed: add to `.proto`, regenerate C/Rust headers via `protoc` — schema PR reviewed once, consumed by every Tier 2 firmware target
3. Firmware engineer writes minimal device-specific logic using the generated header
4. Bench-provision the device via Registration Service `/provision` endpoint
5. Validation Engine gets a new `device_class` allow-list entry defining authorized `metric_types`

> Neither workflow touches Core Services (Ingestion, Validation Engine code, Attribution, Aggregation) — both terminate in either a new adapter package or a new generated-header consumer.

---

## 10. Design Rules — What Must Never Be Violated

### Rule 1 — Core stays platform-agnostic
The `core/` package may **never** import a platform-specific library, directly or transitively. If it would need to, the missing capability belongs behind a new or existing port — not inline in Core.

### Rule 2 — Adapters contain no business logic
No adapter may contain state transitions, retry policy, or scheduling decisions. An adapter's only job is translating a port method into a real OS/hardware call. If an adapter starts making decisions, that logic has leaked out of Core and **will diverge** across platforms.

### Rule 3 — TelemetryEnvelope is always generated, never hand-defined
No Tier 1 or Tier 2 target may hand-define the `TelemetryEnvelope` shape independently. Every consumer generates from `schema/telemetry_envelope.proto`.

### Rule 4 — New device classes never introduce new paths into Core Services
A new device class either gets a Tier 1 adapter or a Tier 2 generated-header integration — both terminate at the same `telemetry.raw` streaming topic, in the same envelope shape. Core Services never branch on device type.

---

## 11. Current Implementation State

**Container topology** (`infra/docker-compose.yml`):

| Container | Service | Port (internal) | Healthcheck |
|---|---|---|---|
| `infra-nginx-1` | nginx | 80, 443 (host) | `curl -fsSk https://127.0.0.1/nginx-health` |
| `ecotrace-frontend` | Next.js | 3000 | Next.js internal |
| `ecotrace-api` | REST API | 3003 | `wget --spider http://localhost:3003/health` |
| `infra-auth-service-1` | JWT verify | 3001 | `wget --spider http://localhost:3001/health` |
| `infra-registration-service-1` | /register | 3002 | `wget --spider http://localhost:3002/health` |
| `infra-ingestion-http-1` | OTLP receiver | 4318 | `wget --spider http://localhost:4318/v1/traces` |
| `infra-ingestion-worker-1` | NATS consumer | 3003 (not exposed) | node process |
| `ecotrace-attribution-engine` | carbon calc | 3004 | `wget -O - http://127.0.0.1:3004/health \| grep '"status":"ok"'` |
| `ecotrace-websocket` | NATS → browser | 3010 (not exposed) | node process |
| `infra-nats-1` | message bus | 4222 (not exposed) | `nats:2.10-alpine` |
| `infra-postgres-1` | storage | 5432 (not exposed) | `pg_isready` |

**All 11 containers healthy.** Only nginx exposes host ports 80/443. NATS (4222) and Postgres (5432) are NOT exposed to host.

**Current runtime state (as of Aug 07, after WSL reboot):** **Up.** All 11 containers healthy (`docker compose up -d` in `infra/`), cloudflared tunnel active (`ecotrace-tunnel.service` active, URL `https://dig-enclosure-blvd-checking.trycloudflare.com`), Linux agent running as `linux-8b9388f3` (points at the current tunnel URL). Windows agent (`windows-285df621`) stopped on the real host — restart via the PowerShell launcher if needed.

**Live public URL:** `https://dig-enclosure-blvd-checking.trycloudflare.com` (cloudflared quick tunnel; URL rotates each restart unless changed).

**Backend routes that exist** (`services/api/index.js`):

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/health` | none | public liveness |
| POST | `/api/auth/login` | none | **public, special-cased in nginx**; admin role accepts any secret |
| GET | `/api/devices` | JWT | filters to `device_class IN ('linux','windows')` AND running (`last_seen_at >= NOW()-10min`); returns `fleet_id, fleet_name, fleet_region, notification_consent, notification_channel` |
| GET | `/api/devices/categories` | JWT | counts per category: `{endpoints, iot, plc, fleets}` |
| GET | `/api/devices/:id/history` | JWT | returns `{device_id, history[]}` |
| GET | `/api/fleet` | JWT | aggregates per fleet via `LEFT JOIN fleets`; returns `{summary, trend, hourly_trend, regions}` — unassigned devices synthesize into `"Unassigned"` region |
| GET | `/api/recommendation` | JWT | returns `{recommendations[], total_potential_savings_kg, last_computed}` — region labeled `${fleet.name} (${fleet.grid_region})` |
| GET | `/api/analytics` | JWT | scope/peak/offset/mix for the Analytics page |
| GET | `/api/fleets` | JWT | list all fleets |
| POST | `/api/fleets` | JWT | create fleet (409 on duplicate name) |
| GET | `/api/fleets/:id` | JWT | fleet detail with `devices[]` (assigned + unassigned partition) |
| PATCH | `/api/fleets/:id` | JWT | update name/description/grid_region/grid_intensity |
| DELETE | `/api/fleets/:id` | JWT | delete fleet (409 if devices assigned) |
| POST | `/api/fleets/:id/devices` | JWT | assign device to fleet |
| DELETE | `/api/fleets/:id/devices/:device_id` | JWT | unassign device |
| GET | `/api/reports/csv?days=N` | JWT | server-streamed CSV (16 cols, JOIN emissions_calculated + devices + fleets + emissions_raw, CSV-injection sanitized) |
| GET | `/api/reports/pdf` | JWT | real PDF via `pdfkit`, contains live totals + fleet breakdown + device table + SHA-256 signature |
| POST | `/api/notifications` | JWT | queue an optimize notification for one device (409 if device not consented or `reco-{device}-{date}` already sent today); audit `notification.sent` |
| GET | `/api/control/notifications` | JWT | **agent-only** — atomically marks `queued→delivered` for the caller's device (`req.deviceId`), limit 20, expiry check |
| POST | `/api/control/notifications/:id/ack` | JWT | **agent-only** — marks the caller's own notification `seen` |
| POST | `/admin/revoke/:device_id` | Admin-Token header | revoke device |

**Other backend services:**
- `auth-service` → `POST /token` (issue JWT), `GET /verify` (validate JWT — used by nginx `auth_request`)
- `registration-service` → `POST /register` (validate `BOOTSTRAP_TOKEN`, INSERT into devices)

**Postgres schema** (`devices`, `daily_summaries`, `emissions_raw`, `emissions_calculated`, `audit_log`, `fleets`, `settings`, `agent_notifications`):
- `devices.device_class` CHECK constraint: `IN ('linux','windows','iot','plc')`
- `devices.status` CHECK constraint: `IN ('active','idle','revoked')`
- `devices.fleet_id` nullable FK → `fleets(id)` ON DELETE SET NULL
- `devices.notification_consent` bool (default false), `notification_channel` text, `notification_poll_interval_s` int (clamped ≥5 at registration)
- `fleets` table: `id`, `name` UNIQUE, `description`, `grid_region`, `grid_intensity_g_per_kwh` (default 240), `created_at`, `updated_at`
- `agent_notifications` table: `id`, `device_id`, `title`, `message`, `severity`, `dedupe_key` (`reco-{device}-{date}`), `status` CHECK `IN ('queued','delivered','seen','expired')`, `created_at`/`delivered_at`/`seen_at`, unique `(device_id, dedupe_key)`

---

## 12. Active Workflow — Telemetry → Dashboard

> **Currently stopped.** The full pipeline below is documented as the canonical resume path: start cloudflared → `docker compose up -d` → start Linux + Windows agents. See §17.1 for exact commands.

```
WSL ./agent/agent  (Go binary at agent/agent)
   ↓ ECOTRACE_SERVER=https://dig-enclosure-blvd-checking.trycloudflare.com
   ↓ ECOTRACE_INSECURE_TLS=true
   ↓ BOOTSTRAP_TOKEN=8c08b5f86085ba7b55469ae22458d792611f6a683868c4db042a9a1aa30c01c2
   ↓ DEVICE_CLASS=linux
   ↓
cloudflared tunnel  (systemd: ecotrace-tunnel.service)
   ↓ *.trycloudflare.com → wss://localhost:443
   ↓
nginx :443
   ├─ /register        → registration-service:3002
   ├─ /auth/token      → auth-service:3001
   ├─ /v1/traces       → ingestion-http:4318  (OTLP)
   ├─ /api/auth/login  → api:3003            (public, no auth_request)
   ├─ /api/health      → api:3003            (public, no auth_request)
   ├─ /api/*           → api:3003            (JWT via auth_request /internal/auth/verify)
   └─ /                → frontend:3000       (Next.js)

ingestion-http → NATS topic
   ↓
ingestion-worker → attribution-engine:3004 → Postgres
   ↓ (UPSERT daily_summaries, UPDATE devices.last_seen_at)

Browser:
   1. POST /api/auth/login → JWT cookie
   2. GET /api/fleet, /api/devices, /api/recommendation, /api/analytics
      ↳ every 30s via setInterval
```

**Verified end-to-end:** Linux agent registers as `linux-071754a3` (hostname=Mainak), Windows agent on the real host as `windows-285df621` (hostname=Mainak, consent=true), both send envelopes every 30s, `/api/devices` returns both running devices, `/api/fleet` shows `active_devices:2`. **No fleets configured by default — admin must create via `/fleet` UI.**

**Control-plane notification path** (same tunnel, outbound polling only — no inbound ports):
```
admin: POST /api/notifications {device_id, title, message}   → agent_notifications (status=queued)
        ↳ 409 if device not consented or reco-{device}-{date} already sent today
Windows agent: GET /api/control/notifications  (every 30s)   → atomically queued→delivered
        ↳ renders system-tray balloon (PowerShell NotifyIcon) with title/message
        ↳ POST /api/control/notifications/:id/ack            → delivered→seen
Dashboard: "Send Optimize Notification" button (only on consenting devices) → POST /api/notifications
```

---

## 13. Environment & Access

- **OS:** WSL Ubuntu 26.04 (`6.6.87.2-microsoft-standard-WSL2`), user `sagnik`, sudo password `sagnik`
- **Docker:** only inside WSL (`/usr/bin/docker`, Client v29.1.3)
- **Self-signed TLS cert:** `infra/certs/nginx.crt`+`nginx.key`, SAN=`IP:127.0.0.1,DNS:localhost`, RSA-2048/365d
- **Repo-root `.env`** holds secrets:
  - `POSTGRES_PASSWORD=qB95G5dCTRXxMCVehbLc4avrU94XdJBuJ9fNHPGmIuBiel7q`
  - `JWT_SECRET=an5BQGuqBIxHB5whmqEu7tOB3SUhDruaAe8scYOMTtIft05A`
  - `BOOTSTRAP_TOKEN=8c08b5f86085ba7b55469ae22458d792611f6a683868c4db042a9a1aa30c01c2`
  - `ADMIN_TOKEN=phase0-bootstrap-token-dev-only` (kept for backward compat)
  - `CORS_ALLOWED_ORIGINS` includes `https://dig-enclosure-blvd-checking.trycloudflare.com`
- **`infra/.env`** is a copy of repo-root `.env`
- **cloudflared:** `/usr/local/bin/cloudflared` v2026.7.3, systemd unit `/etc/systemd/system/ecotrace-tunnel.service` (`cloudflared --no-autoupdate tunnel --no-tls-verify --url https://localhost:443`, user=`sagnik`)
- **`deploy.sh`** preflight tolerates Docker DNS hiccups; auto-discovers tunnel URL from `journalctl -u ecotrace-tunnel`, rewrites `.env`, restarts `api`. After `api` recreate, must `docker compose restart nginx`

---

## 14. What's Done This Session

| # | Change | File(s) |
|---|---|---|
| 1 | DB migration `003_fleets.sql` — created `fleets` table; added nullable `devices.fleet_id` FK ON DELETE SET NULL | `infra/db/migrations/003_fleets.sql` |
| 2 | Full `/api/fleets` CRUD: GET list, POST create (409 on duplicate name), GET `/:id` (with `devices[]`), PATCH `/:id`, DELETE `/:id` (409 if devices assigned), POST `/:id/devices`, DELETE `/:id/devices/:device_id` — all audit-logged | `services/api/index.js` |
| 3 | `/api/devices` enriched with `fleet_id, fleet_name, fleet_region`; filtered to `device_class IN ('linux','windows')` (endpoints only) | `services/api/index.js` |
| 4 | New `/api/devices/categories` returning real fleet count via `COUNT(DISTINCT d.fleet_id)` → `{endpoints, iot, plc, fleets}` | `services/api/index.js` |
| 5 | `/api/fleet` rewritten: per-fleet `LEFT JOIN fleets` aggregation; unassigned devices synthesize into `"Unassigned"` region | `services/api/index.js` |
| 6 | `/api/recommendation` now labels region as `${fleet.name} (${fleet.grid_region})` | `services/api/index.js` |
| 7 | Real `/api/reports/csv?days=N` — server-streamed CSV from `emissions_calculated` JOIN devices JOIN fleets JOIN emissions_raw, 16 cols, CSV-injection sanitized | `services/api/index.js` |
| 8 | Real `/api/reports/pdf` — `pdfkit`-generated PDF with live totals, fleet breakdown, device table, SHA-256 digital signature; added `pdfkit ^0.15.0` dep | `services/api/index.js`, `services/api/package.json` |
| 9 | TS types: `Device` got `fleet_id, fleet_name, fleet_region`; added `Fleet`, `FleetDetail`, `FleetCreateInput`, `FleetUpdateInput`; `DeviceCategory = "endpoint" \| "iot" \| "plc"` (no fleet — fleets are derived counts) | `frontend/types/device.ts`, `frontend/types/fleet.ts` |
| 10 | `services/api/fleets.ts` (CRUD wrappers), `services/api/client.ts` (added `patch` method), `hooks/useFleets.ts`, `hooks/useFleetDetail.ts` | `frontend/services/api/`, `frontend/hooks/` |
| 11 | Split Devices page: nested `app/(dashboard)/devices/{endpoints,iot,plc,fleets}/page.tsx`; `/devices` redirects to `/devices/endpoints`; `/devices/fleets` redirects to `/fleet`; IoT/PLC use `BlockedCategory` placeholder | `frontend/app/(dashboard)/devices/` |
| 12 | `BlockedCategory` placeholder component (icon + "Coming soon" + Tier 2 MQTT path explanation) | `frontend/components/shared/BlockedCategory.tsx` |
| 13 | Sidebar: nested Devices submenu with chevron, live category counts, "P5" badges on IoT/PLC | `frontend/components/navigation/Sidebar/Sidebar.tsx` |
| 14 | Command palette + navbar titles updated for all 5 sub-routes | `frontend/components/navigation/{CommandPalette,Navbar}/` |
| 15 | `app/(dashboard)/fleet/page.tsx` rewritten as registry UI: create-fleet modal, fleet cards, delete-with-conflict-409 | `frontend/app/(dashboard)/fleet/page.tsx` |
| 16 | New `app/(dashboard)/fleet/[id]/page.tsx`: device assignment + unassign table | `frontend/app/(dashboard)/fleet/[id]/page.tsx` |
| 17 | `app/(dashboard)/reports/page.tsx` rewritten: live data context bar, downloads hit `/api/reports/{csv,pdf}`, shows actual file size | `frontend/app/(dashboard)/reports/page.tsx` |
| 18 | Fleet badge on Endpoints page (grid + table) — green pill when assigned, gray "Unassigned" pill when not | `frontend/app/(dashboard)/devices/endpoints/page.tsx` |
| 19 | `constants/routes.ts` + `constants/endpoints.ts` extended with the 4 new device sub-routes and `deviceCategories`/`devicesByCategory` | `frontend/constants/` |
| 20 | Deployed via `bash deploy.sh` — all 11 containers healthy; verified CSV (117 rows, 24 KB) + PDF (1 page, signature `0x4C0384ECC27E452333EFCDAB2B24CD0D`) | `deploy.sh` |
| 21 | Deleted the test fleets `IND-TCS` (id=3) and `US-WEST` (id=2) created during this session's verification — admin starts with truly empty fleet registry | `services/api/index.js` (DELETE endpoints) |
| 22 | **Operational fix:** nginx Docker DNS cache was holding stale `172.18.0.7:4318` for `ingestion-http` after multiple `docker compose up -d` cycles; agent was getting `HTTP 502 → connect() failed (111: Connection refused)`. Fixed with `docker compose restart nginx`. **Always do this after any backend rebuild.** | (operational) |
| 23 | New `GET /api/alerts` — real alert feed derived from live data: critical (today's emissions >50% above fleet avg), warning (registered device offline beyond running window), info (last-24h audit_log lifecycle events); sorted severity→recency, max 25 | `services/api/index.js` |
| 24 | New `GET /api/overview` — headline metrics (active/offline devices, total_carbon_kg, delta vs yesterday) + recent events feed (last-2h telemetry + last-24h lifecycle events) powering `LiveActivityStream` | `services/api/index.js` |
| 25 | New `GET/PATCH /api/settings` + migration `004_settings.sql` (`settings` key/value table) — persists daily_limit_kg / intensity_threshold_g_per_kwh / grid_provider_token; token never returned in full (masked suffix), empty token never wipes stored value, invalid values → 400 | `services/api/index.js`, `infra/db/migrations/004_settings.sql` |
| 26 | Frontend: `useAlerts.ts` rewritten → real `getAlerts()` (30s poll), ack state in localStorage; `LiveActivityStream.tsx` → real `/api/overview` (30s poll, empty/error states); `settings/page.tsx` → loads/saves real `GET/PATCH /api/settings`; added `services/api/{alerts,overview,settings}.ts`, `timeAgo()` helper in `utils/date.ts` | `frontend/` |
| 27 | Global 401 handling: `fetcher.ts` intercepts `401` → clears session token + `window.location.assign('/login')` (guarded on `/login`, login POST uses raw fetch so no loop). Demo-mode payloads added for `/api/alerts`, `/api/overview`, `/api/settings` | `frontend/lib/fetcher.ts` |
| 28 | Re-deployed: migration applied, api rebuilt + nginx restarted, frontend rebuilt (all 11 healthy); verified `/api/alerts`, `/api/overview`, `/api/settings` live through tunnel; rotated tunnel URL in `.env` + restarted agent (re-registered as `linux-071754a3`) | (operational) |
| 29 | Migration `005_notifications.sql` — created `agent_notifications` table (status `queued/delivered/seen/expired`, unique `(device_id, dedupe_key)` for daily-dedupe `reco-{device}-{date}`) + `notification_consent`, `notification_channel`, `notification_poll_interval_s` columns on `devices` | `infra/db/migrations/005_notifications.sql` |
| 30 | Registration now accepts + persists `notification_consent` / `notification_channel` / `notification_poll_interval_s` (clamped ≥5s) | `services/registration-service/index.js` |
| 31 | Control-plane notification endpoints: `POST /api/notifications` (409 if not consented or already sent today, audit `notification.sent`), `GET /api/control/notifications` (agent-only, atomic `queued→delivered`, limit 20, expiry check), `POST /api/control/notifications/:id/ack` (agent-only, → `seen`); `/api/devices` now returns `notification_consent` + `notification_channel` | `services/api/index.js` |
| 32 | Agent Core `NotificationInbox` port + `NotificationPoller` (immediate poll then interval, min 5s) in `core/notification.go`; `RegistrationConfig` gained consent fields | `agent/core/notification.go`, `agent/core/registration.go` |
| 33 | Windows adapter fully implemented (previously stubs): file-based `KeyStore` (`%USERPROFILE%\.ecotrace`), stdlib Win32 `MetricSource` (CPU via GetSystemTimes, mem via GlobalMemoryStatusEx, network deltas via GetIfTable), `Transport` wrapper, `NotificationInbox` (poll → system-tray balloon via PowerShell NotifyIcon → ack) | `agent/adapter/windows/*.go`, `agent/main_windows.go` |
| 34 | Windows agent built (`agent/agent.exe`, 11.5 MB) and **launched on the real Windows host** via `agent/start_windows_agent.ps1` (Start-Process, logs to `D:\EcoTrace\agent\agent-windows*.log`) — registered as `windows-285df621`, hostname `Mainak`, consent=true, channel=balloon, telemetry every 30s | `agent/start_windows_agent.ps1`, `agent/agent.exe` |
| 35 | **Notification loop verified live:** admin `POST /api/notifications` → `queued`; Windows agent polled → `delivered` (balloon toast rendered) → `ack` → `seen` in DB; second same-day send correctly 409-deduped; consent gate rejects non-consenting Linux device | (e2e verified) |
| 36 | Frontend "Send Optimize Notification" button: `Device` type + `sendOptimizeNotification()` wrapper (`services/api/notifications.ts`), button on Endpoints grid card + table actions — rendered only for `notification_consent` devices, 409 → "already sent today" toast | `frontend/types/device.ts`, `frontend/services/api/notifications.ts`, `frontend/constants/endpoints.ts`, `frontend/app/(dashboard)/devices/endpoints/page.tsx` |
| 37 | Deployed: api + frontend rebuilt, nginx restarted, all 11 containers healthy; verified `/api/devices` returns `windows-285df621 → consent:true/channel:balloon` and `linux-071754a3 → consent:false`; Linux agent confirmed still running (no restart needed) | (operational) |
| 38 | **Carbon Analytics drill-down, backend only** (frontend deferred per user): `GET /api/analytics/fleets` (per-fleet cards: carbon today, active devices, grid intensity, delta vs yesterday, "Unassigned" bucket, org totals vs `daily_limit_kg` threshold), `GET /api/analytics/fleets/:id` (devices in fleet + live CPU/mem avgs + top-3 services), `GET /api/analytics/devices/:id` (24h carbon history, hourly cpu/mem/net workload, per-service breakdown, live state, threshold) | `services/api/index.js` |
| 39 | Applied migration `006_service_attribution.sql` to the live DB (was present in repo but never run — `emissions_by_service` table did not exist): adds `devices.rated_tdp_w`/`base_power_w` + `emissions_by_service` table + indexes | `infra/db/migrations/006_service_attribution.sql` |
| 40 | Deployed: api rebuilt, full stack brought up (`docker compose up -d`), nginx restarted; all 11 containers healthy. Tunnel URL rotated → `https://dig-enclosure-blvd-checking.trycloudflare.com` (rewrote `.env` + `infra/.env` CORS/TUNNEL). Verified all 3 new endpoints live: `/api/analytics/fleets` (INFOTRICS fleet id=4, 2 devices, 11.6 kg today), `/api/analytics/fleets/4` (both devices w/ cpu/mem), `/api/analytics/devices/linux-071754a3` (7.16 kg, 3 hourly history pts); `/api/analytics` regression OK | (operational) |
| 41 | **Carbon Analytics drill-down frontend** (completes the deferred part of #38): types + fetchers `getAnalyticsFleets/getAnalyticsFleet/getAnalyticsDevice` in `services/api/analytics.ts`; `useAnalyticsFleets/useAnalyticsFleet/useAnalyticsDevice` hooks (`hooks/useAnalyticsDrilldown.ts`); new `analyticsFleets/analyticsFleet/analyticsDevice` endpoints + `analyticsFleet/analyticsDevice` routes; real SVG `BarChart` (replaces placeholder — grouped CPU/MEM bars + x labels, AreaChart sizing/CSS-var pattern); `/analytics` page gains "Fleet Emissions Breakdown" (org-vs-budget bar, per-fleet cards → drill down, Unassigned bucket banner); new `/analytics/fleets/[id]` (fleet meta + devices table w/ cpu/mem/carbon/top-service → device link); new `/analytics/devices/[id]` (KPI row, 24h carbon AreaChart, hourly workload BarChart, per-service attribution bars, budget-position bar, power-model/last-seen/fleet footer) | `frontend/` |
| 42 | Deployed: frontend rebuilt (`next build` clean — TS + lint pass), stack brought up, nginx restarted, all 11 containers healthy; tunnel URL rotated → `https://dig-enclosure-blvd-checking.trycloudflare.com`. Verified `/login` 200, `/analytics`, `/analytics/fleets/4`, `/analytics/devices/<id>` all serve (307 → `/login?from=` when unauthenticated = normal auth guard, not an error); `frontend` logs clean. Linux agent restarted → registered `linux-1734a253`, telemetry confirmed through pipeline (3 raw / 2 calculated rows for 2026-08-07; attribution-engine spot-checks processing). Note: day rolled to Aug 07 while agents were stopped, so daily_summaries shows 08-05 data until today's aggregates populate | (operational) |
| 43 | **Workflow/service-level attribution made live (the "entire drill down" completion).** Root cause: the shipped `agent/agent` binary (Aug 2) predated the per-process collection code in `adapter/{linux,windows}/process_*.go` (Aug 5) — it was sending envelopes with no `processes[]`. Also the `attribution-engine` image (Aug 2) predated the `emissions_by_service` Phase-2 code (Aug 5). Fixes: rebuilt `agent/agent` + `agent/agent.exe` (Go 1.22, `GOOS=linux/windows`), rebuilt `attribution-engine` image, restarted Linux agent. Now: envelopes carry `processes[]` (cgroup→service mapping, 40 max), `process_count`, `load_average_1m`; attribution-engine splits variable energy 70% CPU / 30% RSS into `emissions_by_service`. Verified live: `raw_payload->processes` = 40, `emissions_by_service` has rows (`init`, `containerd.service`, docker container, `docker.service`), `/api/analytics/devices/linux-1734a253` returns `services[].pct`, `/api/analytics/fleets/4` shows `top_services`. Note: `init` dominates (~95%) on the near-idle WSL host — a weighting artifact, not a bug. Windows agent.exe rebuilt but **not relaunched** on the real host (was stopped) | `agent/adapter/linux/process_linux.go`, `agent/adapter/windows/process_windows.go`, `agent/core/ports.go`, `agent/core/envelope.go`, `services/attribution-engine/index.js`, rebuilt `agent/agent`+`agent/agent.exe` |
| 44 | **Real workload + WSL fixes + Windows relaunch.** (a) Relaunched Windows agent on the real host via `start_windows_agent.ps1` (URL updated to the current tunnel) → running as `windows-285df621`, sending every 30s, processes mapped by exe name. (b) Launched non-system workloads in WSL (3× `yes` CPU burners + a python3 300 MB memory spinner) to make attribution meaningful. (c) **WSL cgroup fix:** WSL2 puts every user process (even pid 1) under `/init.scope`, so `serviceName()` was collapsing them all to "init". Now `/init.scope` → process name. (d) **RSS bug fix:** `procRSSBytes` read `fields[22]` = field 25 (`rsslim` = `RLIM_INFINITY` → `-1 × page` → `-4096`); corrected to `fields[21]` = field 24 (rss). Rebuilt both binaries, restarted Linux agent. Verified: `yes`/`python3`/`opencode`/docker (`docker-<id>` scopes, `containerd.service`) all appear in `emissions_by_service`; `/api/analytics/devices/linux-1734a253` services: init 57.6%, yes 17.5%, opencode 12%, python3 3.5%, containerd+docker ~3%; `/api/analytics/devices/windows-285df621` services: msedge 56.3%, dllhost, audiodg, WindowsTerminal, Notion, explorer; live cpu/mem/load/process_count all populated | `agent/adapter/linux/process_linux.go`, `agent/start_windows_agent.ps1` |
| 45 | **Flat enterprise design refactor (visual only — no logic/API changes).** Replaced the glassmorphism/glow/rounded theme with a flat palette: `variables.css` (`#0A0E13` bg, `#111720` panel, `#161D28` elevated, `#1E2A36` border, `#E2E8F0` text, `#22C55E` accent, `#F59E0B` amber, `#3B82F6` blue, `#EF4444` red), shadows→none, radii→6px, glows→transparent; `theme.css` de-glass + `.label-caps`; `animations.css` dropped drift/float; `tailwind.config.ts` flat tokens + new aliases `moderate`/`high`/`amber`/`blue`/`warning`/`info`; `constants/colors.ts`; `(dashboard)/layout.tsx` full-width, `SustainabilityBackground`→null. Restyled all shared components (Sidebar, Navbar, Card/Badge/Button/Table/Modal/Spinner, PageHeader, NoDataState, Skeleton, EmptyState, LiveIndicator, DeviceStatus, FleetCard, TrendChart, DeviceTable, LiveActivityStream, RecoCard, RoadmapModal, ThemeToggle, BlockedCategory, UserMenu, CommandPalette, AreaChart/BarChart — AreaChart gradients stripped to flat `--clean` fill). Restyled all pages via 5 parallel agents with a token-mapping spec (dashboard, analytics + drilldowns, fleet + detail, devices/endpoints + alerts + reports + settings, auth login/register/forgot + auth layout) — gradients, glows, shadows, backdrop-blurs, decorative radii (`rounded-[…]`, `rounded-2xl/3xl/xl/lg`→`rounded`), `bg-panel-solid dark:* bg-white`→`bg-panel`, slate/emerald/rose/sky hex→tokens, `transition-all`→`transition-colors`, decorative `animate-*` removed (kept `animate-spin`/`fade-in`/`scale-in`). `next build` clean (26/26 pages) + `next lint` clean. `node_modules` now installed locally in `frontend/` (was absent — build verified via Docker before). Note: `frontend/.eslintrc.json` etc. show as modified only from pre-existing uncommitted state | `frontend/` (all pages + components + styles + tailwind.config.ts + constants/colors.ts) |
| 46 | **Tunnel recovery (2×).** (a) First fix: `ecotrace-tunnel.service` was up but stuck in a reconnect loop (`control stream encountered a failure`), public URL dead (HTTP 000). Restarted tunnel → URL rotated to `brake-anonymous-theft-harder.trycloudflare.com`; rewrote `.env`/`infra/.env` CORS+TUNNEL, recreated `api`, restarted `nginx`; killed stale Linux agent (old `pkill -f agent/agent` didn't match a `./agent` process), relaunched with new URL. (b) **WSL rebooted** (uptime reset) → tunnel auto-restarted via systemd but URL rotated again to `dig-enclosure-blvd-checking.trycloudflare.com`; repeated `.env`/`infra/.env`/ps1/CONTEXT rewrite + `api` recreate + `nginx` restart; Linux agent re-registered as `linux-8b9388f3`, telemetry confirmed via `/api/devices`. **Lesson: after any WSL reboot, tunnel URL rotates — re-check `journalctl -u ecotrace-tunnel` and rewrite `.env` CORS/TUNNEL before restarting agents** | (operational) |

**Hard-reload browser** (Ctrl+Shift+R) after any frontend rebuild to clear Next.js RSC cache.

---

## 15. Known Issues / Mock Data Still Present

| File | What's mock | Fix needed |
|---|---|---|
| `frontend/app/(dashboard)/devices/page.tsx:76-82,349,92` | `carbon_g: 120.0`, `status: "registering"`, `"99.8%"`, POST to nonexistent `/api/devices` | Add `POST /api/devices` route; replace hardcoded values — but page is now just a redirect so low priority |
| `frontend/app/(auth)/login/page.tsx:142` | `-18.6% vs last month` (decorative hero metric, pre-auth marketing panel) | Replace with `/api/overview` metric — but requires public auth or pre-auth endpoint; cosmetic |
| `frontend/DEMO_SCRIPT.md` | References `/devices` (now `/devices/endpoints`) | Cosmetic; out of scope unless user requests |

**Resolved this session** (moved to history):
- ~~`FleetCard.tsx:145,153` `"240 gCO2e/kWh"`, `"Clean Operating Zone"`~~ → wired to live data
- ~~`Sidebar.tsx:24` `badge: "12 active"`~~ → bound to `useDevicesByCategory`
- ~~`reports/page.tsx:65,72,91` `"2.4 MB"`, `"14 MB"`, `"July 2026"`~~ → real CSV/PDF downloads
- ~~`hooks/useAlerts.ts` `INITIAL_ALERTS`~~ → real `GET /api/alerts` (derived from live devices/daily_summaries/audit_log); ack state persisted in localStorage
- ~~`LiveActivityStream.tsx` 3 hardcoded events~~ → real `GET /api/overview` events feed (recent telemetry + lifecycle events), 30s polling
- ~~`settings/page.tsx` `dailyLimit/intensityThreshold/apiToken` hardcoded~~ → `GET/PATCH /api/settings` backed by new `settings` table (migration `004_settings.sql`); token masked on GET, empty token never wipes stored value
- ~~`client.ts`/`fetcher.ts` no global 401 redirect~~ → `fetcher.ts` intercepts `401` → clears session + `window.location.assign('/login')` (login POST excluded, no loop)

---

## 16. ✅ Completed Previously — Device Categorization (Endpoints / IoT / Fleets / PLC)

### 16.1 Goal (achieved)

Split the Devices section into four categorized sub-sections:

1. **Endpoints** — Tier 1 agents (Linux servers, Windows workstations). Live data flowing.
2. **IoT** — Tier 2 devices. **Blocked from frontend** — placeholder only.
3. **Fleets** — Logical groupings (admin-managed). Live, per region cluster.
4. **PLC** — Tier 2 controllers. **Blocked from frontend** — placeholder only.

### 16.2 Final UI structure (delivered)

Sidebar nested Devices submenu:

```
Sidebar
└── Devices ▾
    ├── Endpoints   → /devices/endpoints    (live list, Tier 1)
    ├── IoT Sensors → /devices/iot          (Phase 5 placeholder)
    ├── Fleets      → /devices/fleets       (redirects to /fleet)
    └── PLC         → /devices/plc          (Phase 5 placeholder)
```

Top-level "Fleet Regions" sibling: `/fleet` → admin-managed fleet registry with CRUD.

### 16.3 Acceptance criteria (all met)

- [x] `/devices/endpoints` shows live `linux-071754a3` with real carbon data + fleet badge
- [x] `/devices/iot` and `/devices/plc` show `BlockedCategory` placeholder, no API calls, no mock data
- [x] `/devices/fleets` redirects to `/fleet` (live fleet registry)
- [x] Sidebar nested Devices submenu with live category counts (`{endpoints:1, iot:0, plc:0, fleets:0}`)
- [x] Backend `/api/devices` still only returns running Endpoints (no IoT/PLC leakage)
- [x] Login → JWT → real data flows end-to-end

---

## 17. Next Task — TBD

No pending task. User satisfied with current state:

- Telemetry flowing — **1 active endpoint**: `linux-8b9388f3` (Linux, consent=false) — re-registered after WSL reboot; Windows agent (`windows-285df621`) stopped on the real host, restart via `agent/start_windows_agent.ps1` if needed
- Control-plane notifications **fully live**: admin `POST /api/notifications` → Windows agent balloon toast → `queued→delivered→seen`; daily dedupe (409) verified; frontend "Send Optimize Notification" button on Endpoints page for consenting devices
- `/api/fleets` returns `[INFOTRICS (id=4)]` — one fleet (`IN-KOL` region) with `linux-8b9388f3` assigned
- Dashboard, Devices, Fleet registry, Fleet detail (assign/unassign), Reports (real CSV/PDF) all live
- All 11 containers healthy; nginx DNS cache issue resolved

**Possible next directions** (awaiting user input):

1. **Tier 2 wiring** — implement MQTT + mTLS path so IoT/PLC placeholders become live (the "Phase 5" path from CONTEXT.md §1, §7)
2. **Notifications polish** — per-day reset demo (dedupe blocks a second same-day toast); add delivered/seen status readback on the button; ack via toast click instead of auto-ack; NCrypt/DPAPI hardening for the Windows keystore
3. **Settings page** — wire or remove the three hardcoded values (`dailyLimit`, `intensityThreshold`, `apiToken`)
4. **Multi-device test** — register a second Linux/Windows agent to verify fleet assignment at scale and to exercise the `/api/devices/categories.fleets` count
5. **Windows service packaging** — wrap `agent.exe` in a Windows Service (sc.exe / NSSM) with auto-start so it survives host reboots like the Linux systemd unit

### 17.1 Build / restart sequence

Full bring-up from a stopped state (order matters — tunnel first, then stack, then agents):
```bash
# 1. cloudflared tunnel (URL rotates; capture it from journalctl after start)
echo 'sagnik' | sudo -S systemctl daemon-reload        # unit changed on disk; required before start
echo 'sagnik' | sudo -S systemctl start ecotrace-tunnel.service
journalctl -u ecotrace-tunnel -n 20 --no-pager | grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' | tail -1
#    → set this as ECOTRACE_SERVER for the agents + update .env TUNNEL_PUBLIC_URL / CORS

# 2. Stack
cd /mnt/d/EcoTrace/infra && docker compose up -d && docker compose ps   # all 11 healthy
#    if a .env/TUNNEL change touches api CORS: docker compose restart api nginx

# 3. Agents (Linux in WSL, Windows on real host) — commands below
```

After any backend change:
```bash
cd /mnt/d/EcoTrace/infra && docker compose build --no-cache api && docker compose up -d api
docker compose restart nginx   # ALWAYS after api recreate (Docker DNS cache)
```

After any frontend change:
```bash
cd /mnt/d/EcoTrace/infra && docker compose build --no-cache frontend && docker compose up -d frontend
docker compose restart nginx   # same DNS-cache rule applies to frontend recreate
```

To start/restart the Linux agent:
```bash
cd /mnt/d/EcoTrace
pkill -f "agent/agent" 2>/dev/null; sleep 1
setsid bash -c 'ECOTRACE_SERVER=https://dig-enclosure-blvd-checking.trycloudflare.com \
  ECOTRACE_INSECURE_TLS=true \
  BOOTSTRAP_TOKEN=8c08b5f86085ba7b55469ae22458d792611f6a683868c4db042a9a1aa30c01c2 \
  DEVICE_CLASS=linux AGENT_INTERVAL=30s \
  exec ./agent/agent > /tmp/ecotrace-agent.log 2>&1' < /dev/null > /dev/null 2>&1 &
disown
```

To start/restart the Windows agent (real host, via WSL interop):
```bash
cd /mnt/d/EcoTrace/agent
cmd.exe /c powershell -NoProfile -ExecutionPolicy Bypass -File D:\EcoTrace\agent\start_windows_agent.ps1
```
Script: kills prior `D:\EcoTrace\*` `agent.exe`, `Start-Process` hidden, logs to `D:\EcoTrace\agent\agent-windows.log` (stdout) + `agent-windows-err.log` (stderr — registration/telemetry/notification lines). **The WSL `powershell.exe` call may hang ~60s+ while the child agent keeps the interop pipe open — that's expected; verify with `Get-Process agent` instead.** Note: the launcher run only once works; subsequent runs should just `Start-Process` the exe directly or check for an existing process.

To get a JWT for curl testing:
```bash
TOKEN=$(curl -k -sS -X POST "https://dig-enclosure-blvd-checking.trycloudflare.com/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"device_id":"admin@ecotrace.io","secret":"x","device_class":"admin"}' \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])')
```
```
