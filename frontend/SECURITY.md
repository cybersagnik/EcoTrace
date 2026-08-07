# Security Policy & Vulnerability Severity Reference Guide

This document outlines the Security Architecture, Threat Model, Vulnerability Classification Matrix, and Remediation Protocols for the **EcoTrace Enterprise Sustainability Observability Platform**.

---

## 🎯 Vulnerability Severity Rating Matrix

Vulnerabilities identified within EcoTrace are rated using the **CVSS v3.1 (Common Vulnerability Scoring System)** and **OWASP Risk Rating Methodology**.

```
+-----------------------------------------------------------------------------------+
|  SEVERITY RATING   |  CVSS v3.1 RANGE  |  REMEDIATION SLA   |  ACTION REQUIRED    |
+--------------------+-------------------+--------------------+---------------------+
|  🚨 CRITICAL       |     9.0 - 10.0    |    < 24 Hours      |  Emergency Patch    |
|  🔴 HIGH           |     7.0 - 8.9     |    < 48 Hours      |  Priority Release   |
|  🟡 MEDIUM         |     4.0 - 6.9     |    < 7 Days        |  Scheduled Sprint   |
|  🟢 LOW            |     0.1 - 3.9     |    < 30 Days       |  Backlog Hardening  |
|  ℹ️ INFORMATIONAL  |        0.0        |    Optional        |  Architecture Note  |
+-----------------------------------------------------------------------------------+
```

---

## 🔍 Detailed Severity Classifications & Audit Results

### 1. 🚨 CRITICAL SEVERITY (CVSS 9.0 - 10.0)

Vulnerabilities that allow unauthenticated attackers to bypass authentication entirely, execute remote code, or perform unauthorized administrative actions.

#### Finding 1.1: Unprotected Middleware Route Guard
- **Location**: [`middleware.ts`](file:///e:/project/EcoTrace/extract%20all/ecotrace-frontend/middleware.ts)
- **CVSS v3.1**: **9.8 (CRITICAL)** — `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H`
- **OWASP Category**: OWASP A01:2021 - Broken Access Control
- **CWE**: CWE-306 (Missing Authentication for Critical Function)
- **Impact**: Unauthenticated users can access `/dashboard`, `/devices`, `/fleet`, `/analytics`, `/reports`, `/alerts`, `/settings`.

#### Finding 1.2: Unauthenticated REST API Handlers
- **Location**: [`app/api/devices/route.ts`](file:///e:/project/EcoTrace/extract%20all/ecotrace-frontend/app/api/devices/route.ts)
- **CVSS v3.1**: **9.1 (CRITICAL)** — `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N`
- **OWASP Category**: OWASP API1:2023 - Broken Object Level Authorization (BOLA)
- **CWE**: CWE-285 (Improper Authorization)
- **Impact**: Unauthenticated remote attackers can query, inject, modify, or delete hardware telemetry nodes.

---

### 2. 🔴 HIGH SEVERITY (CVSS 7.0 - 8.9)

Vulnerabilities that allow unauthorized data tampering, mass assignment, code execution via exports, or clickjacking.

#### Finding 2.1: Mass Assignment in API Body Parser
- **Location**: [`app/api/devices/route.ts`](file:///e:/project/EcoTrace/extract%20all/ecotrace-frontend/app/api/devices/route.ts#L54)
- **CVSS v3.1**: **8.2 (HIGH)** — `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:H/A:N`
- **OWASP Category**: OWASP API6:2023 - Mass Assignment
- **CWE**: CWE-915 (Improper Dynamically Evaluated Object Attributes)
- **Impact**: Attackers can override internal object attributes (`schema_version`, system flags).

#### Finding 2.2: CSV Formula / Command Injection
- **Location**: [`utils/export.ts`](file:///e:/project/EcoTrace/extract%20all/ecotrace-frontend/utils/export.ts#L60-L64)
- **CVSS v3.1**: **7.8 (HIGH)** — `CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:H`
- **OWASP Category**: OWASP A03:2021 - Injection
- **CWE**: CWE-1236 (CSV Formula Injection)
- **Impact**: Malicious telemetry device names starting with `=`, `+`, `-`, or `@` execute arbitrary OS commands when opened in Microsoft Excel.

#### Finding 2.3: Absence of HTTP Security Response Headers
- **Location**: [`next.config.js`](file:///e:/project/EcoTrace/extract%20all/ecotrace-frontend/next.config.js)
- **CVSS v3.1**: **7.5 (HIGH)** — `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:P/I:P/A:N`
- **OWASP Category**: OWASP A05:2021 - Security Misconfiguration
- **CWE**: CWE-693 (Protection Mechanism Failure)
- **Impact**: Exposes platform to clickjacking (`X-Frame-Options`), MIME sniffing, and unencrypted transport (`HSTS`).

---

### 3. 🟡 MEDIUM SEVERITY (CVSS 4.0 - 6.9)

Vulnerabilities that result in resource exhaustion, unencrypted token storage, or MIME anomalies.

#### Finding 3.1: Missing API Rate Limiting Controls
- **Location**: `app/api/*`
- **CVSS v3.1**: **6.5 (MEDIUM)**
- **OWASP Category**: OWASP API4:2023 - Unrestricted Resource Consumption
- **CWE**: CWE-770

#### Finding 3.2: Session Token Storage in LocalStorage
- **Location**: `lib/demoMode.ts`
- **CVSS v3.1**: **5.4 (MEDIUM)**
- **OWASP Category**: OWASP A02:2021 - Cryptographic Failures
- **CWE**: CWE-922

#### Finding 3.3: Insecure MIME Type Blob Declaration in PDF Generator
- **Location**: `utils/export.ts`
- **CVSS v3.1**: **4.3 (MEDIUM)**
- **OWASP Category**: OWASP A05:2021 - Security Misconfiguration
- **CWE**: CWE-434

---

## 🛡️ Secure Development Guidelines & SSDLC Requirements

1. **Input Validation**: All incoming API request parameters must be parsed via `zod` schemas.
2. **Session Security**: Session tokens must be transferred in `HttpOnly`, `Secure`, `SameSite=Strict` cookies.
3. **CSV Export Neutralization**: String values starting with `=`, `+`, `-`, or `@` must be prepended with a single quote (`'`).
4. **Rate Limiting**: Sliding window rate limiters must throttle all public API endpoints.
