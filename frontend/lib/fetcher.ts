import { getIsDemoMode } from "./demoMode";
import { clearSessionToken } from "./auth";

/**
 * On an unauthenticated 401 response, drop the stale session token and
 * bounce to the login page — unless we're already there (the login POST
 * goes through a raw fetch and never reaches this path, so no loop).
 */
function redirectToLogin(): void {
  if (typeof window === "undefined") return;
  if (window.location.pathname.startsWith("/login")) return;
  clearSessionToken();
  window.location.assign("/login");
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "";

export function resolveUrl(url: string): string {
  if (/^https?:\/\//.test(url)) return url;
  return `${API_BASE_URL}${url}`;
}

/**
 * Strict fetch wrapper — NEVER falls back to mock data.
 *
 * Only Demo Mode (explicit user opt-in via localStorage) returns
 * pre-recorded payloads so the demo button still works in
 * presentations when the backend is unreachable. In all other
 * cases (network failure, 5xx, 401) errors propagate so the UI
 * can show the real status instead of pretending everything is
 * fine.
 */
export async function fetcher<T>(url: string, init?: RequestInit): Promise<T> {
  const resolved = resolveUrl(url);

  if (getIsDemoMode()) {
    return getDemoPayload<T>(resolved);
  }

  try {
    const res = await fetch(resolved, init);
    if (!res.ok) {
      if (res.status === 401) redirectToLogin();
      const text = await res.text().catch(() => "");
      throw new ApiError(res.status, text || res.statusText, resolved);
    }
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(0, (err as Error).message, resolved);
  }
}

export class ApiError extends Error {
  status: number;
  body: string;
  url: string;
  constructor(status: number, body: string, url: string) {
    super(`API ${status} on ${url}: ${body.slice(0, 200)}`);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
    this.url = url;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Demo Mode payloads
//
// ONLY used when the user explicitly enables Demo Mode in the navbar.
// All other code paths throw on failure and surface the real error.
// ─────────────────────────────────────────────────────────────────────
const DEMO_DEVICES = [
  {
    device_id: "edge-node-linux-04",
    device_class: "linux-server",
    os: "Ubuntu 22.04 LTS",
    hostname: "edge-node-linux-04",
    carbon_g: 184.6,
    energy_wh_today: 1.1,
    sample_count: 1,
    status: "operating",
    last_seen_at: new Date().toISOString(),
    schema_version: "v1.0",
  },
  {
    device_id: "ws-win-audrey",
    device_class: "windows-workstation",
    os: "Windows 11 Pro",
    hostname: "ws-win-audrey",
    carbon_g: 412.1,
    energy_wh_today: 2.4,
    sample_count: 1,
    status: "operating",
    last_seen_at: new Date().toISOString(),
    schema_version: "v1.0",
  },
  {
    device_id: "edge-gateway-01",
    device_class: "iot-sensor",
    os: "Debian 12 (Bookworm)",
    hostname: "edge-gateway-01",
    carbon_g: 95.3,
    energy_wh_today: 0.6,
    sample_count: 1,
    status: "operating",
    last_seen_at: new Date().toISOString(),
    schema_version: "v1.0",
  },
];

function getDemoPayload<T>(url: string): T {
  const path = url.replace(/^https?:\/\/[^/]+/, "");

  if (path === "/api/devices") return DEMO_DEVICES as unknown as T;

  if (path === "/api/fleet") {
    const total_carbon_g = DEMO_DEVICES.reduce((s, d) => s + d.carbon_g, 0);
    return {
      summary: {
        active_devices: DEMO_DEVICES.length,
        total_carbon_g,
        total_carbon_kg: total_carbon_g / 1000,
        total_energy_wh: DEMO_DEVICES.reduce((s, d) => s + d.energy_wh_today, 0),
        delta_pct_vs_yesterday: -3.1,
        grid_region: "US-CAL",
        last_sync_seconds_ago: 12,
        last_updated: new Date().toISOString(),
        intensity: total_carbon_g < 250 ? "clean" : "moderate",
      },
      trend: [],
      hourly_trend: [],
      regions: [
        { region: "US-CAL", carbon_kg: total_carbon_g / 1000, active_devices: DEMO_DEVICES.length },
      ],
    } as unknown as T;
  }

  if (path === "/api/recommendation") {
    return {
      recommendations: [
        {
          id: "rec-demo-1",
          title: "Demo recommendation (Demo Mode)",
          description: "Enable Demo Mode is on — no real telemetry is flowing.",
          impact_kg: 0.0,
          region: "US-CAL",
          priority: "medium",
          action_label: "Disable Demo Mode",
        },
      ],
      total_potential_savings_kg: 0,
      last_computed: new Date().toISOString(),
    } as unknown as T;
  }

  if (path === "/api/health") {
    return { status: "ok", timestamp: new Date().toISOString() } as unknown as T;
  }

  if (path === "/api/alerts") {
    const now = Date.now();
    return {
      alerts: [
        {
          id: "demo-alert-1",
          title: "High Carbon Intensity Threshold Exceeded (Demo Mode)",
          device: DEMO_DEVICES[0].device_id,
          time: new Date(now - 10 * 60000).toISOString(),
          severity: "critical",
          message: "Demo Mode is active — this alert mirrors real telemetry once a device is online.",
          acknowledged: false,
        },
        {
          id: "demo-alert-2",
          title: "Telemetry Sensor Degraded Signal (Demo Mode)",
          device: DEMO_DEVICES[1].device_id,
          time: new Date(now - 45 * 60000).toISOString(),
          severity: "warning",
          message: "Demo Mode is active — no real sensor has been degraded.",
          acknowledged: false,
        },
      ],
      generated_at: new Date().toISOString(),
    } as unknown as T;
  }

  if (path === "/api/overview") {
    const now = Date.now();
    return {
      metrics: {
        active_devices: DEMO_DEVICES.length,
        offline_devices: 0,
        total_carbon_kg: DEMO_DEVICES.reduce((s, d) => s + d.carbon_g, 0) / 1000,
        delta_pct_vs_yesterday: -3.1,
        last_updated: new Date().toISOString(),
      },
      events: [
        {
          id: "demo-evt-1",
          time: new Date(now - 120000).toISOString(),
          device: DEMO_DEVICES[0].device_id,
          event: "Telemetry payload received (Demo Mode)",
          type: "info",
        },
        {
          id: "demo-evt-2",
          time: new Date(now - 300000).toISOString(),
          device: DEMO_DEVICES[1].device_id,
          event: "Grid intensity auto-matched via WattTime API (Demo Mode)",
          type: "success",
        },
      ],
    } as unknown as T;
  }

  if (path === "/api/settings") {
    return {
      daily_limit_kg: 300,
      intensity_threshold_g_per_kwh: 250,
      grid_provider_configured: false,
      grid_provider_token_masked: null,
    } as unknown as T;
  }

  return {} as T;
}
