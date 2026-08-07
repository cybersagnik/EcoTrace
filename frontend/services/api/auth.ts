import { apiClient } from "./client";

export interface LoginRequest {
  device_id: string;
  secret?: string;
  device_class?: string;
}

export interface LoginResponse {
  access_token: string;
  expires_at: string;
}

export function login(payload: LoginRequest): Promise<LoginResponse> {
  return apiClient.post<LoginResponse>("/api/auth/login", payload);
}

export function logout(): Promise<{ ok: true }> {
  return apiClient.post<{ ok: true }>("/api/auth/logout");
}
