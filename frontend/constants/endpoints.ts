// Endpoints configuration for real Ingestion/Query API and Phase 3 automated optimization
export const ENDPOINTS = {
  devices: "/api/devices",
  deviceCategories: "/api/devices/categories",
  devicesByCategory: (category: "endpoint" | "iot" | "plc") =>
    `/api/devices?category=${category}`,
  fleet: "/api/fleet",
  analytics: "/api/analytics",
  analyticsFleets: "/api/analytics/fleets",
  analyticsFleet: (id: number) => `/api/analytics/fleets/${id}`,
  analyticsDevice: (id: string) => `/api/analytics/devices/${id}`,
  health: "/api/health",
  recommendation: "/api/recommendation",
  deviceHistory: (id: string) => `/api/devices/${id}/history`,
  alerts: "/api/alerts",
  overview: "/api/overview",
  settings: "/api/settings",
  notifications: "/api/notifications",
  aiStatus: "/api/ai/status",
  aiAnalyze: "/api/ai/analyze",
  aiAnalyzeQa: "/api/ai/analyze-qa",
} as const;
