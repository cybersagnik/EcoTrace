import { apiClient } from "./client";
import { ENDPOINTS } from "@/constants/endpoints";

export interface SettingsResponse {
  daily_limit_kg: number;
  intensity_threshold_g_per_kwh: number;
  grid_provider_configured: boolean;
  grid_provider_token_masked: string | null;
}

export interface SettingsUpdateInput {
  daily_limit_kg?: number;
  intensity_threshold_g_per_kwh?: number;
  grid_provider_token?: string;
}

export function getSettings(): Promise<SettingsResponse> {
  return apiClient.get<SettingsResponse>(ENDPOINTS.settings);
}

export function updateSettings(input: SettingsUpdateInput): Promise<{ updated: boolean }> {
  return apiClient.patch<{ updated: boolean }>(ENDPOINTS.settings, input);
}
