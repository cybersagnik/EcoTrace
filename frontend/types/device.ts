export type DeviceClass =
  | "linux-server"
  | "windows-workstation"
  | "iot-sensor"
  | "plc-controller";

export type DeviceStatus = "operating" | "registering" | "offline";

export interface Device {
  device_id: string;
  device_class: DeviceClass;
  os?: string;
  carbon_g: number;
  status: DeviceStatus;
  schema_version: string;
}
