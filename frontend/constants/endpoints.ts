// Endpoints configuration for real Ingestion/Query API and Phase 3 automated optimization
export const ENDPOINTS = {
  devices: "/api/devices",
  fleet: "/api/fleet",
  analytics: "/api/analytics",
  health: "/api/health",
  recommendation: "/api/recommendation",
  deviceHistory: (id: string) => `/api/devices/${id}/history`,
} as const;
