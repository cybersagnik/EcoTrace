import { apiClient } from "./client";
import { ENDPOINTS } from "@/constants/endpoints";

export interface EnergyMixItem {
  source: string;
  pct: number;
  kwh: number;
  type: string;
}

export interface AnalyticsResponse {
  scope_emissions_kg: number;
  delta_pct: number;
  peak_window: string;
  offset_saved_kg: number;
  equivalent_trees: number;
  clean_pct: number;
  mix: EnergyMixItem[];
  last_updated: string;
}

export function getAnalytics(): Promise<AnalyticsResponse> {
  return apiClient.get<AnalyticsResponse>(ENDPOINTS.analytics);
}

// ─────────────────────────────────────────────────────────────────────
// Carbon Analytics drill-down — level 1: per-fleet cards + org totals
// ─────────────────────────────────────────────────────────────────────
export interface AnalyticsFleetCard {
  id: number;
  name: string;
  grid_region: string;
  grid_intensity_g_per_kwh: number;
  active_devices: number;
  total_devices: number;
  carbon_g_today: number;
  carbon_kg_today: number;
  energy_wh_today: number;
  delta_pct_vs_yesterday: number;
}

export interface AnalyticsFleetsTotals {
  carbon_kg_today: number;
  energy_wh_today: number;
  active_devices: number;
  daily_limit_kg: number;
  threshold_exceeded: boolean;
  threshold_pct: number;
}

export interface AnalyticsFleetsResponse {
  fleets: AnalyticsFleetCard[];
  unassigned: {
    active_devices: number;
    carbon_kg_today: number;
    energy_wh_today: number;
    delta_pct_vs_yesterday: number;
  };
  totals: AnalyticsFleetsTotals;
  last_updated: string;
}

export function getAnalyticsFleets(): Promise<AnalyticsFleetsResponse> {
  return apiClient.get<AnalyticsFleetsResponse>(ENDPOINTS.analyticsFleets);
}

// ─────────────────────────────────────────────────────────────────────
// Level 2: devices inside a single fleet
// ─────────────────────────────────────────────────────────────────────
export interface AnalyticsFleetDevice {
  device_id: string;
  device_class: string;
  os: string | null;
  hostname: string | null;
  status: string;
  last_seen_at: string | null;
  carbon_g_today: number;
  energy_wh_today: number;
  cpu_avg: number;
  mem_avg: number;
  rated_tdp_w: number;
  base_power_w: number;
  top_services: { service: string; carbon_g: number }[];
}

export interface AnalyticsFleetDetail {
  fleet: {
    id: number;
    name: string;
    description: string | null;
    grid_region: string;
    grid_intensity_g_per_kwh: number;
  };
  summary: {
    carbon_kg_today: number;
    energy_wh_today: number;
    devices_total: number;
    devices_online: number;
  };
  devices: AnalyticsFleetDevice[];
}

export function getAnalyticsFleet(id: number): Promise<AnalyticsFleetDetail> {
  return apiClient.get<AnalyticsFleetDetail>(ENDPOINTS.analyticsFleet(id));
}

// ─────────────────────────────────────────────────────────────────────
// Level 3: full device view — carbon history, workload, services
// ─────────────────────────────────────────────────────────────────────
export interface AnalyticsDeviceCarbonHistoryPoint {
  hour: string;
  carbon_g: number;
}

export interface AnalyticsDeviceWorkloadHour {
  hour: string;
  cpu_avg: number;
  mem_avg: number;
  net_kbps: number;
}

export interface AnalyticsDeviceService {
  service: string;
  energy_wh: number;
  carbon_g: number;
  pct: number;
}

export interface AnalyticsDeviceDetail {
  device: {
    device_id: string;
    device_class: string;
    os: string | null;
    hostname: string | null;
    status: string;
    last_seen_at: string | null;
    rated_tdp_w: number;
    base_power_w: number;
    notification_consent: boolean;
    fleet_id: number | null;
    fleet_name: string | null;
    grid_region: string | null;
    grid_intensity_g_per_kwh: number;
  };
  carbon: {
    today_g: number;
    today_kg: number;
    yesterday_g: number;
    delta_pct_vs_yesterday: number;
    daily_limit_kg: number;
    vs_threshold_pct: number;
    history: AnalyticsDeviceCarbonHistoryPoint[];
  };
  workload: {
    current: {
      cpu: number;
      mem: number;
      load_average_1m: number;
      process_count: number;
    };
    hourly: AnalyticsDeviceWorkloadHour[];
  };
  services: AnalyticsDeviceService[];
  last_updated: string;
}

export function getAnalyticsDevice(id: string): Promise<AnalyticsDeviceDetail> {
  return apiClient.get<AnalyticsDeviceDetail>(ENDPOINTS.analyticsDevice(id));
}
