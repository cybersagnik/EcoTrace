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
