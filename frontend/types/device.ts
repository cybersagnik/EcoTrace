export type DeviceClass =
  | "linux-server"
  | "windows-workstation"
  | "iot-sensor"
  | "plc-controller";

// device_category maps to the backend /api/devices response — every
// device row carries one of these three. "fleet" is NOT a device
// category; it's a logical grouping surfaced by /api/fleet.regions.
export type DeviceCategory = "endpoint" | "iot" | "plc";

export type DeviceStatus = "operating" | "registering" | "offline";

export interface Device {
  device_id: string;
  device_class: DeviceClass;
  device_category?: DeviceCategory;
  os?: string;
  hostname?: string | null;
  carbon_g: number;
  energy_wh_today?: number;
  sample_count?: number;
  status: DeviceStatus;
  schema_version: string;
  last_seen_at?: string | null;
  // Populated by /api/devices; null when device is not assigned to a fleet.
  fleet_id?: number | null;
  fleet_name?: string | null;
  fleet_region?: string | null;
  // Set only for devices that opted into control-plane notifications at
  // registration. Only these can receive "Send Optimize Notification".
  notification_consent?: boolean;
  notification_channel?: string | null;
}

// Counts per category for the sidebar badges. `fleets` is the count
// of active grid regions with at least one running device.
export interface DeviceCategoryCounts {
  endpoints: number;
  iot: number;
  plc: number;
  fleets: number;
}
