import { IntensityLevel } from "./common";

export interface FleetSummary {
  total_carbon_kg: number;
  total_carbon_g?: number;
  delta_pct_vs_yesterday: number;
  grid_region: string;
  last_sync_seconds_ago: number;
  last_updated?: string;
  intensity: IntensityLevel;
  active_devices: number;
}

export interface FleetRegion {
  region: string;
  grid_region?: string;
  carbon_kg: number;
  energy_wh?: number;
  active_devices: number;
}

export interface TrendPoint {
  day: string;
  carbon_kg: number;
}

export interface HourlyTrendPoint {
  hour: string;
  carbon_g: number;
  emissions_raw?: number;
}

export interface Fleet {
  id: number;
  name: string;
  description: string | null;
  grid_region: string;
  grid_intensity_g_per_kwh: number;
  total_devices: number;
  active_devices: number;
  carbon_g_today: number;
  energy_wh_today: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface FleetDetail extends Omit<Fleet, "total_devices" | "active_devices" | "carbon_g_today" | "energy_wh_today"> {
  devices: Array<{
    device_id: string;
    device_class: string;
    device_category?: "endpoint" | "iot" | "plc";
    os: string | null;
    hostname: string | null;
    status: string;
    last_seen_at: string | null;
    carbon_g: number;
    energy_wh_today: number;
  }>;
}

export interface FleetCreateInput {
  name: string;
  description?: string;
  grid_region: string;
  grid_intensity_g_per_kwh: number;
}

export interface FleetUpdateInput {
  name?: string;
  description?: string;
  grid_region?: string;
  grid_intensity_g_per_kwh?: number;
}
