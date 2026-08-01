import { apiClient } from "./client";
import { ENDPOINTS } from "@/constants/endpoints";
import { FleetSummary, TrendPoint, HourlyTrendPoint, FleetRegion } from "@/types/fleet";

export interface FleetResponse {
  summary: FleetSummary;
  trend: TrendPoint[];
  hourly_trend?: HourlyTrendPoint[];
  regions?: FleetRegion[];
}

export function getFleetSummary(): Promise<FleetResponse> {
  return apiClient.get<FleetResponse>(ENDPOINTS.fleet);
}
