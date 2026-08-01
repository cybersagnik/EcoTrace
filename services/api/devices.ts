import { apiClient } from "./client";
import { ENDPOINTS } from "@/constants/endpoints";
import { Device } from "@/types/device";
import { HourlyTrendPoint } from "@/types/fleet";

export interface DeviceHistoryResponse {
  device_id: string;
  history: HourlyTrendPoint[];
}

export function getDevices(): Promise<Device[]> {
  return apiClient.get<Device[]>(ENDPOINTS.devices);
}

export function getDeviceHistory(deviceId: string): Promise<DeviceHistoryResponse> {
  return apiClient.get<DeviceHistoryResponse>(ENDPOINTS.deviceHistory(deviceId));
}
