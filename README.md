# EcoTrace — Enterprise Sustainability Observability Platform

Next.js 14 (App Router) + TypeScript + Tailwind CSS enterprise-grade Sustainability Observability Platform.

---

## 🛡️ Security Vulnerability & Severity Assessment Matrix

This project includes a comprehensive pre-production security assessment evaluating the platform against **OWASP Top 10 (2021)**, **OWASP API Security Top 10 (2023)**, **OWASP ASVS v4**, **NIST SP 800-53**, and **CWE Top 25** standards.

### Severity Rating Criteria

| Severity Level | CVSS v3.1 Score | Definition & Impact Threshold | Remediation SLA |
| :--- | :--- | :--- | :--- |
| 🚨 **CRITICAL** | **9.0 – 10.0** | Vulnerabilities that allow unauthenticated remote code execution, total authentication bypass, or full database access with zero user interaction. | **Immediate (P0 - < 24 Hours)** |
| 🔴 **HIGH** | **7.0 – 8.9** | Vulnerabilities that allow unauthorized data modification, mass assignment, CSV injection, or missing critical security headers leading to privilege escalation. | **P1 - < 48 Hours** |
| 🟡 **MEDIUM** | **4.0 – 6.9** | Vulnerabilities that expose endpoints to rate-limiting DoS, unencrypted client-side token storage, or MIME-type spoofing anomalies. | **P2 - < 1 Week** |
| 🟢 **LOW** | **0.1 – 3.9** | Minor security misconfigurations, overly permissive CORS origin policies, or non-sensitive information leakage. | **P3 - Sprint Backlog** |
| ℹ️ **INFO** | **0.0** | Architectural hardening recommendations, internal naming disclosures, or code hygiene suggestions. | **P4 - Optional Enhancement** |

---

## 📋 Comprehensive Security Vulnerability Catalog

### 🚨 Critical Severity Vulnerabilities

#### 1. Unenforced Next.js Route Guard Middleware (`middleware.ts`)
- **Severity**: 🚨 **CRITICAL (CVSS 9.8)**
- **OWASP / CWE**: OWASP A01:2021 - Broken Access Control | CWE-306 (Missing Authentication)
- **Description**: The Next.js middleware is currently configured as a blank passthrough (`matcher: []`), allowing unauthenticated remote attackers to directly access protected enterprise dashboard routes (`/dashboard`, `/devices`, `/fleet`, `/analytics`, `/reports`, `/alerts`, `/settings`).
- **Remediation**: Configure explicit route matchers in `middleware.ts` and validate JWT session tokens before granting request passthrough.

#### 2. Unauthenticated REST API Endpoints ([`app/api/devices/route.ts`](file:///e:/project/EcoTrace/extract%20all/ecotrace-frontend/app/api/devices/route.ts))
- **Severity**: 🚨 **CRITICAL (CVSS 9.1)**
- **OWASP / CWE**: OWASP API1:2023 - Broken Object Level Authorization (BOLA) | CWE-285
- **Description**: REST API handlers (`GET`, `POST`, `DELETE`) process incoming HTTP requests without verifying Authorization headers or JWT cookies, allowing unauthorized attackers to purge telemetry nodes or inject rogue hardware nodes.
- **Remediation**: Enforce token authorization middleware on all REST API handlers.

---

### 🔴 High Severity Vulnerabilities

#### 3. Mass Assignment & Untrusted Object State Mutation ([`app/api/devices/route.ts`](file:///e:/project/EcoTrace/extract%20all/ecotrace-frontend/app/api/devices/route.ts#L54))
- **Severity**: 🔴 **HIGH (CVSS 8.2)**
- **OWASP / CWE**: OWASP API6:2023 - Mass Assignment | CWE-915
- **Description**: `POST` API route handler directly merges untrusted request JSON body attributes into the internal object state via spread syntax (`{ ...mockDevices[index], ...body }`) without DTO schema validation.
- **Remediation**: Parse incoming body payloads using strict Zod DTO schemas before object assignment.

#### 4. CSV Formula / Command Injection ([`utils/export.ts`](file:///e:/project/EcoTrace/extract%20all/ecotrace-frontend/utils/export.ts#L60-L64))
- **Severity**: 🔴 **HIGH (CVSS 7.8)**
- **OWASP / CWE**: OWASP A03:2021 - Injection | CWE-1236 (CSV Formula Injection)
- **Description**: CSV export functions format dataset rows without neutralizing formula initiation characters (`=`, `+`, `-`, `@`). Opening exported files in Excel/Calc can execute arbitrary operating system commands.
- **Remediation**: Prepend a single quote (`'`) to any string field starting with `=`, `+`, `-`, or `@`.

#### 5. Missing HTTP Security Response Headers ([`next.config.js`](file:///e:/project/EcoTrace/extract%20all/ecotrace-frontend/next.config.js))
- **Severity**: 🔴 **HIGH (CVSS 7.5)**
- **OWASP / CWE**: OWASP A05:2021 - Security Misconfiguration | CWE-693
- **Description**: Application configuration omits essential HTTP response headers (`Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`).
- **Remediation**: Inject standard security headers into `next.config.js`.

---

### 🟡 Medium Severity Vulnerabilities

#### 6. Unrestricted Resource Consumption & Missing Rate Limiting
- **Severity**: 🟡 **MEDIUM (CVSS 6.5)**
- **OWASP / CWE**: OWASP API4:2023 - Unrestricted Resource Consumption | CWE-770
- **Description**: REST API routes lack rate-limiting throttles, exposing backend services to automated Denial of Service (DoS) attacks.
- **Remediation**: Implement sliding-window rate limiting via `@upstash/ratelimit`.

#### 7. Session Token Storage in Browser LocalStorage
- **Severity**: 🟡 **MEDIUM (CVSS 5.4)**
- **OWASP / CWE**: OWASP A02:2021 - Cryptographic Failures | CWE-922
- **Description**: Storing authentication tokens in unencrypted browser `localStorage` exposes session credentials to extraction via DOM XSS vulnerabilities.
- **Remediation**: Store authentication tokens in `HttpOnly`, `Secure`, `SameSite=Strict` cookies.

#### 8. Insecure Blob MIME-Type Specification ([`utils/export.ts`](file:///e:/project/EcoTrace/extract%20all/ecotrace-frontend/utils/export.ts#L119))
- **Severity**: 🟡 **MEDIUM (CVSS 4.3)**
- **OWASP / CWE**: OWASP A05:2021 - Security Misconfiguration | CWE-434
- **Description**: PDF export generator encapsulates plain text strings inside a Blob declared as `type: "application/pdf"`, causing PDF parser errors.
- **Remediation**: Use a true PDF binary compilation library (`jspdf`).

---

### 🟢 Low & ℹ️ Informational Findings

#### 9. Permissive CORS Origin Configuration
- **Severity**: 🟢 **LOW (CVSS 3.7)**
- **OWASP / CWE**: OWASP API7:2023 - Security Misconfiguration | CWE-942
- **Description**: Wildcard CORS reflection allows cross-origin requests from arbitrary third-party domains.

#### 10. Information Disclosure in Client-Side Fallback Bundle
- **Severity**: ℹ️ **INFORMATIONAL (CVSS 0.0)**
- **OWASP / CWE**: OWASP A01:2021 - Information Disclosure | CWE-200
- **Description**: Hardcoded fallback data in `lib/fetcher.ts` discloses internal infrastructure naming conventions.

---

## 🎨 EcoTrace Design System v1.0 Tokens

- **Primary Colors**: Emerald Green (`#16A34A`), Forest Green (`#166534`), Sky Blue (`#0EA5E9`), Cyan (`#14B8A6`), Deep Navy (`#0F172A`), White (`#FFFFFF`).
- **Light Mode Surfaces**: Background (`#F8FAFC`), Cards (`#FFFFFF`), Surface (`#F1F5F9`), Text Primary (`#0F172A`).
- **Dark Mode Surfaces**: Background (`#020617`), Cards (`#0F172A`), Surface (`#1E293B`), Primary Text (`#F8FAFC`).
- **Radii Specifications**: Cards `24px`, Buttons `16px`, Inputs `14px`, Modals `28px`.

---

## 🚀 Getting Started

### Development
```bash
npm install
npm run dev
```

### Run Tests
```bash
npm test
```

### Production Build Verification
```bash
npm run build
```
