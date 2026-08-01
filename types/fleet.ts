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
  carbon_kg: number;
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
