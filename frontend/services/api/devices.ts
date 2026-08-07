import { apiClient } from "./client";
import { ENDPOINTS } from "@/constants/endpoints";
import { Device, DeviceCategoryCounts, DeviceCategory } from "@/types/device";
import { HourlyTrendPoint } from "@/types/fleet";

export interface DeviceHistoryResponse {
  device_id: string;
  history: HourlyTrendPoint[];
}

export function getDevices(): Promise<Device[]> {
  return apiClient.get<Device[]>(ENDPOINTS.devices);
}

export function getDevicesByCategory(category: DeviceCategory): Promise<Device[]> {
  return apiClient.get<Device[]>(ENDPOINTS.devicesByCategory(category));
}

export function getDeviceCategories(): Promise<DeviceCategoryCounts> {
  return apiClient.get<DeviceCategoryCounts>(ENDPOINTS.deviceCategories);
}

export function getDeviceHistory(deviceId: string): Promise<DeviceHistoryResponse> {
  return apiClient.get<DeviceHistoryResponse>(ENDPOINTS.deviceHistory(deviceId));
}
