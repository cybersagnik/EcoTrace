export const ROUTES = {
  dashboard: "/dashboard",
  devices: "/devices",
  fleet: "/fleet",
  analytics: "/analytics",
  reports: "/reports",
  alerts: "/alerts",
  settings: "/settings",
  login: "/login",
  register: "/register",
  forgotPassword: "/forgot-password",
} as const;

export const NAV_ITEMS = [
  { label: "Dashboard", href: ROUTES.dashboard },
  { label: "Devices", href: ROUTES.devices },
  { label: "Fleet", href: ROUTES.fleet },
  { label: "Analytics", href: ROUTES.analytics },
  { label: "Reports", href: ROUTES.reports },
  { label: "Alerts", href: ROUTES.alerts },
  { label: "Settings", href: ROUTES.settings },
] as const;
