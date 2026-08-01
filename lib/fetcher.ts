import { getIsDemoMode } from "./demoMode";

/**
 * Pre-recorded, crash-proof fallback data dictionary.
 * Used when Demo Mode is explicitly enabled or when live network/API calls fail.
 */
const MOCK_FALLBACKS: Record<string, unknown> = {
  "/api/fleet": {
    summary: {
      total_carbon_kg: 12.4,
      total_carbon_g: 12400.0,
      delta_pct_vs_yesterday: -3.1,
      grid_region: "US-EAST",
      last_sync_seconds_ago: 12,
      last_updated: new Date().toISOString(),
      intensity: "moderate",
      active_devices: 4,
    },
    trend: [
      { day: "Mon", carbon_kg: 13.8 },
      { day: "Tue", carbon_kg: 14.2 },
      { day: "Wed", carbon_kg: 15.6 },
      { day: "Thu", carbon_kg: 16.9 },
      { day: "Fri", carbon_kg: 12.1 },
      { day: "Sat", carbon_kg: 10.4 },
      { day: "Sun", carbon_kg: 12.4 },
    ],
    hourly_trend: Array.from({ length: 24 }, (_, i) => ({
      hour: `${i.toString().padStart(2, "0")}:00`,
      carbon_g: Math.round((350 + Math.sin((i / 24) * Math.PI * 2) * 150) * 10) / 10,
      emissions_raw: Math.round((350 + Math.sin((i / 24) * Math.PI * 2) * 150) * 1.05 * 100) / 100,
    })),
    regions: [
      { region: "US-EAST (N. Virginia)", carbon_kg: 5.2, active_devices: 2 },
      { region: "EU-WEST (Frankfurt)", carbon_kg: 4.1, active_devices: 1 },
      { region: "AP-SOUTH (Mumbai)", carbon_kg: 3.1, active_devices: 1 },
    ],
  },
  "/api/devices": [
    {
      device_id: "edge-node-linux-04",
      device_class: "linux-server",
      os: "Ubuntu 22.04 LTS",
      carbon_g: 184.6,
      status: "operating",
      schema_version: "1.0.0",
    },
    {
      device_id: "ws-win-audrey",
      device_class: "windows-workstation",
      os: "Windows 11 Pro",
      carbon_g: 412.1,
      status: "operating",
      schema_version: "1.0.0",
    },
    {
      device_id: "edge-gateway-01",
      device_class: "iot-sensor",
      os: "Debian 12 (Bookworm)",
      carbon_g: 95.3,
      status: "operating",
      schema_version: "1.0.0",
    },
    {
      device_id: "plc-node-factory-a",
      device_class: "plc-controller",
      os: "Alpine Linux 3.19",
      carbon_g: 310.8,
      status: "registering",
      schema_version: "1.0.0",
    },
  ],
  "/api/analytics": {
    scope_emissions_kg: 2840.4,
    delta_pct: -12.4,
    peak_window: "18:00 - 20:00",
    offset_saved_kg: 412.8,
    equivalent_trees: 18,
    clean_pct: 64.5,
    mix: [
      { source: "Solar & Wind", pct: 52.0, kwh: 1477, type: "clean" },
      { source: "Hydroelectric", pct: 12.5, kwh: 355, type: "clean" },
      { source: "Regional Thermal Grid", pct: 35.5, kwh: 1008, type: "thermal" },
    ],
    last_updated: new Date().toISOString(),
  },
  "/api/recommendation": {
    recommendations: [
      {
        id: "reco-01",
        title: "Shift Heavy Compute to EU-West (Frankfurt)",
        description: "EU-West grid carbon intensity is currently 82% wind & solar (98 gCO2e/kWh vs 240 gCO2e/kWh in US-East). Auto-routing workloads will save 18.4 kg CO2e daily.",
        impact_kg: 18.4,
        region: "EU-West",
        priority: "critical",
        action_label: "Execute Load Shift",
      },
      {
        id: "reco-02",
        title: "Initiate Solar Battery Storage Discharge",
        description: "Datacenter battery reserves are 100% charged. Discharging during 18:00-20:00 peak grid load cuts Scope 2 carbon footprint.",
        impact_kg: 14.2,
        region: "US-East",
        priority: "high",
        action_label: "Trigger Battery Discharge",
      },
      {
        id: "reco-03",
        title: "Throttle High-Intensity Workstation (ws-win-audrey)",
        description: "Device ws-win-audrey is consuming 412.1g CO2e/hr (Top Emitter). Enabling dynamic power management caps consumption below 250g.",
        impact_kg: 8.6,
        region: "US-East",
        priority: "medium",
        action_label: "Apply Eco Profile",
      },
    ],
    total_potential_savings_kg: 41.2,
    last_computed: new Date().toISOString(),
  },
  "/api/health": {
    status: "ok",
    timestamp: new Date().toISOString(),
  },
};

function getFallbackPayload<T>(url: string): T {
  // Direct matching
  if (MOCK_FALLBACKS[url]) {
    return MOCK_FALLBACKS[url] as T;
  }

  // Device history pattern matching (/api/devices/:id/history)
  if (url.includes("/devices/") && url.includes("/history")) {
    const parts = url.split("/");
    const deviceId = parts[3] || "device-node";
    return {
      device_id: deviceId,
      history: Array.from({ length: 24 }, (_, i) => ({
        hour: `${i.toString().padStart(2, "0")}:00`,
        carbon_g: Math.round((180 + Math.sin((i / 24) * Math.PI * 2) * 60) * 10) / 10,
        emissions_raw: Math.round((180 + Math.sin((i / 24) * Math.PI * 2) * 60) * 1.05 * 100) / 100,
      })),
    } as unknown as T;
  }

  // Generic fallback if unknown endpoint
  return {} as T;
}

/**
 * Non-invasive fetch wrapper. Intercepts network calls safely if Demo Mode is active
 * or if network/API server encounters errors during live presentations.
 */
export async function fetcher<T>(url: string, init?: RequestInit): Promise<T> {
  // If Demo Mode is explicitly toggled ON, serve crash-proof mock instantly
  if (getIsDemoMode()) {
    return getFallbackPayload<T>(url);
  }

  try {
    const res = await fetch(url, init);
    if (!res.ok) {
      // Safe fallback on HTTP errors (e.g. 500, 429)
      return getFallbackPayload<T>(url);
    }
    return (await res.json()) as T;
  } catch {
    // Safe fallback on network exceptions / offline mode
    return getFallbackPayload<T>(url);
  }
}
