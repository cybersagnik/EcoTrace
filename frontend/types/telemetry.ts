/**
 * QA Dashboard — telemetry dataset types.
 *
 * The QA Dashboard imports telemetry exports (CSV) and validates them
 * against the canonical TelemetryEnvelope contract (see
 * schema/telemetry_envelope.proto). These types are the client-side
 * representation of one validated data row plus the validation pipeline
 * artifacts (issues, filters, quality score).
 */

export const TELEMETRY_SCHEMA_COLUMNS = [
  "Timestamp",
  "Device ID",
  "Device Class",
  "OS",
  "Hostname",
  "Fleet ID",
  "Fleet Name",
  "Grid Region",
  "Energy (Wh)",
  "Carbon (g CO2e)",
  "CPU Usage (%)",
  "Memory Usage (%)",
  "Network Sent (bytes)",
  "Network Received (bytes)",
  "Device Status",
  "Attribution Model",
] as const;

export type TelemetryColumn = (typeof TELEMETRY_SCHEMA_COLUMNS)[number];

export enum DeviceClass {
  LinuxServer = "linux-server",
  WindowsWorkstation = "windows-workstation",
}

export enum DeviceOs {
  Linux = "linux",
  Windows = "windows",
}

export enum DeviceStatus {
  Active = "active",
  Inactive = "inactive",
  Error = "error",
}

export enum AttributionModel {
  V01 = "v0.1",
  V02 = "v0.2",
  V03 = "v0.3",
}

export interface TelemetryRow {
  /** 0-based index into the imported dataset (stable across filtering). */
  rowIndex: number;
  timestamp: string;
  deviceId: string;
  deviceClass: string;
  os: string;
  hostname: string;
  fleetId: string | null;
  fleetName: string | null;
  gridRegion: string | null;
  energyWh: number;
  carbonG: number;
  cpuUsagePct: number;
  memoryUsagePct: number;
  networkSentBytes: number;
  networkReceivedBytes: number;
  deviceStatus: string;
  attributionModel: string;
}

export type IssueSeverity = "error" | "warning" | "info";

export type IssueCode =
  | "SCHEMA_COLS"
  | "EXTRA_COLS"
  | "NULL_TIMESTAMP"
  | "NULL_DEVICE_ID"
  | "INVALID_CPU"
  | "INVALID_MEM"
  | "NEGATIVE_ENERGY"
  | "NEGATIVE_CARBON"
  | "UNKNOWN_DEVICE_CLASS"
  | "UNKNOWN_OS"
  | "UNKNOWN_ATTRIBUTION"
  | "NULL_FLEET_MISMATCH"
  | "GRID_REGION_MISSING"
  | "DUPLICATE_ROW"
  | "FUTURE_TIMESTAMP"
  | "STALE_TIMESTAMP";

export interface ValidationIssue {
  /** Row index the issue refers to; null for file/header-level issues. */
  rowIndex: number | null;
  code: IssueCode;
  severity: IssueSeverity;
  message: string;
}

export interface FilterState {
  deviceIds: string[];
  fleetIds: string[];
  regions: string[];
  statuses: string[];
  dateFrom: string | null;
  dateTo: string | null;
}

export type QaTab = "csv" | "manual";

export interface QaSourceInfo {
  fileName: string;
  rowCount: number;
  importedAt: string;
}

export type QualityZone = "green" | "amber" | "red";

export interface QualityScore {
  score: number;
  zone: QualityZone;
  errors: number;
  warnings: number;
  infos: number;
}
