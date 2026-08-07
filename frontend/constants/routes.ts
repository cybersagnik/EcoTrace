export const ROUTES = {
  dashboard: "/dashboard",
  devices: "/devices",
  devicesEndpoints: "/devices/endpoints",
  devicesIot: "/devices/iot",
  devicesFleets: "/devices/fleets",
  devicesPlc: "/devices/plc",
  fleet: "/fleet",
  analytics: "/analytics",
  analyticsFleet: (id: number) => `/analytics/fleets/${id}`,
  analyticsDevice: (id: string) => `/analytics/devices/${id}`,
  reports: "/reports",
  alerts: "/alerts",
  settings: "/settings",
  login: "/login",
  register: "/register",
  forgotPassword: "/forgot-password",
} as const;

export const NAV_ITEMS = [
  { label: "Dashboard", href: ROUTES.dashboard },
  { label: "Devices", href: ROUTES.devicesEndpoints },
  { label: "Fleet", href: ROUTES.fleet },
  { label: "Analytics", href: ROUTES.analytics },
  { label: "Reports", href: ROUTES.reports },
  { label: "Alerts", href: ROUTES.alerts },
  { label: "Settings", href: ROUTES.settings },
] as const;
