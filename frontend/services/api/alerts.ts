import { apiClient } from "./client";
import { ENDPOINTS } from "@/constants/endpoints";

export type AlertSeverity = "critical" | "warning" | "info";

export interface AlertItem {
  id: string;
  title: string;
  device: string;
  time: string;
  severity: AlertSeverity;
  message: string;
  acknowledged: boolean;
}

export interface AlertsResponse {
  alerts: AlertItem[];
  generated_at: string;
}

export function getAlerts(): Promise<AlertsResponse> {
  return apiClient.get<AlertsResponse>(ENDPOINTS.alerts);
}
