import { apiClient } from "./client";
import { ENDPOINTS } from "@/constants/endpoints";

export interface OverviewEvent {
  id: string;
  time: string;
  device: string;
  event: string;
  type: "info" | "success" | "warning";
}

export interface OverviewMetrics {
  active_devices: number;
  offline_devices: number;
  total_carbon_kg: number;
  delta_pct_vs_yesterday: number;
  last_updated: string;
}

export interface OverviewResponse {
  metrics: OverviewMetrics;
  events: OverviewEvent[];
}

export function getOverview(): Promise<OverviewResponse> {
  return apiClient.get<OverviewResponse>(ENDPOINTS.overview);
}
