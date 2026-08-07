import { apiClient } from "./client";
import { Fleet, FleetDetail, FleetCreateInput, FleetUpdateInput } from "@/types/fleet";

export function getFleets(): Promise<Fleet[]> {
  return apiClient.get<Fleet[]>("/api/fleets");
}

export function getFleet(id: number): Promise<FleetDetail> {
  return apiClient.get<FleetDetail>(`/api/fleets/${id}`);
}

export function createFleet(input: FleetCreateInput): Promise<Fleet> {
  return apiClient.post<Fleet>("/api/fleets", input);
}

export function updateFleet(id: number, input: FleetUpdateInput): Promise<{ updated: boolean; id: number }> {
  return apiClient.patch<{ updated: boolean; id: number }>(`/api/fleets/${id}`, input);
}

export function deleteFleet(id: number): Promise<{ deleted: boolean; id: number; name: string }> {
  return apiClient.delete<{ deleted: boolean; id: number; name: string }>(`/api/fleets/${id}`);
}

export function assignDeviceToFleet(
  fleetId: number,
  deviceId: string
): Promise<{ assigned: boolean; device_id: string; fleet_id: number; fleet_name: string }> {
  return apiClient.post(`/api/fleets/${fleetId}/devices`, { device_id: deviceId });
}

export function unassignDeviceFromFleet(
  fleetId: number,
  deviceId: string
): Promise<{ unassigned: boolean; device_id: string; fleet_id: number }> {
  return apiClient.delete(`/api/fleets/${fleetId}/devices/${encodeURIComponent(deviceId)}`);
}
