import {
  AttributionModel,
  DeviceClass,
  DeviceOs,
  IssueCode,
  IssueSeverity,
  QualityScore,
  TELEMETRY_SCHEMA_COLUMNS,
  TelemetryRow,
  ValidationIssue,
} from "@/types/telemetry";
import { ParsedCsv } from "./csvParser";

export const ISSUE_META: Record<IssueCode, { label: string; severity: IssueSeverity }> = {
  SCHEMA_COLS: { label: "Header schema mismatch", severity: "error" },
  EXTRA_COLS: { label: "Row exceeds column count", severity: "error" },
  NULL_TIMESTAMP: { label: "Missing / invalid timestamp", severity: "error" },
  NULL_DEVICE_ID: { label: "Missing device ID", severity: "error" },
  INVALID_CPU: { label: "CPU usage out of range", severity: "error" },
  INVALID_MEM: { label: "Memory usage out of range", severity: "error" },
  NEGATIVE_ENERGY: { label: "Negative / non-numeric energy", severity: "error" },
  NEGATIVE_CARBON: { label: "Negative / non-numeric carbon", severity: "error" },
  UNKNOWN_DEVICE_CLASS: { label: "Unknown device class", severity: "warning" },
  UNKNOWN_OS: { label: "Unknown OS", severity: "warning" },
  UNKNOWN_ATTRIBUTION: { label: "Unknown attribution model", severity: "warning" },
  NULL_FLEET_MISMATCH: { label: "Missing / inconsistent fleet assignment", severity: "warning" },
  GRID_REGION_MISSING: { label: "Missing grid region", severity: "warning" },
  DUPLICATE_ROW: { label: "Duplicate (timestamp, device ID)", severity: "warning" },
  FUTURE_TIMESTAMP: { label: "Timestamp in the future", severity: "error" },
  STALE_TIMESTAMP: { label: "Stale timestamp (> 30 days old)", severity: "info" },
};

export const SEVERITY_ORDER: IssueSeverity[] = ["error", "warning", "info"];

const STALE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

const EMPTY = (v: string | undefined): boolean => !v || v.trim() === "";

const toNumber = (v: string | undefined): number | null => {
  if (EMPTY(v)) return null;
  const n = Number.parseFloat((v as string).trim());
  return Number.isFinite(n) ? n : null;
};

const normalize = (v: string | undefined): string => (v ?? "").trim().toLowerCase();

export function validateCsv(parsed: ParsedCsv): { rows: TelemetryRow[]; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];

  const expected = TELEMETRY_SCHEMA_COLUMNS.map((c) => c.toLowerCase());
  const actual = parsed.headers.map((h) => h.trim().toLowerCase());

  const schemaOk =
    actual.length === expected.length && actual.every((h, idx) => h === expected[idx]);

  if (!schemaOk) {
    issues.push({
      rowIndex: null,
      code: "SCHEMA_COLS",
      severity: "error",
      message: `Header does not match the expected 16-column schema. Expected: ${expected.join(", ")}. Found: ${actual.join(", ") || "(empty)"}.`,
    });
  }

  const rows: TelemetryRow[] = [];
  const seen: Map<string, number[]> = new Map();

  parsed.rows.forEach((cells, idx) => {
    const rowIndex = idx;
    const rowIssues: ValidationIssue[] = [];

    if (cells.length > parsed.headers.length && parsed.headers.length > 0) {
      rowIssues.push({
        rowIndex,
        code: "EXTRA_COLS",
        severity: "error",
        message: `Row has ${cells.length} columns but the header defines ${parsed.headers.length}.`,
      });
    }

    const get = (pos: number): string | undefined => cells[pos];

    const timestamp = (get(0) ?? "").trim();
    const deviceId = (get(1) ?? "").trim();
    const deviceClass = normalize(get(2));
    const os = normalize(get(3));
    const hostname = (get(4) ?? "").trim();
    const fleetId = EMPTY(get(5)) ? null : (get(5) as string).trim();
    const fleetName = EMPTY(get(6)) ? null : (get(6) as string).trim();
    const gridRegion = EMPTY(get(7)) ? null : (get(7) as string).trim();
    const energyNum = toNumber(get(8));
    const carbonNum = toNumber(get(9));
    const cpuNum = toNumber(get(10));
    const memNum = toNumber(get(11));
    const netSent = toNumber(get(12));
    const netRecv = toNumber(get(13));
    const deviceStatus = normalize(get(14));
    const attributionModel = normalize(get(15));

    // Timestamp
    const tsDate = Date.parse(timestamp);
    if (EMPTY(get(0))) {
      rowIssues.push({
        rowIndex,
        code: "NULL_TIMESTAMP",
        severity: "error",
        message: "Timestamp is empty.",
      });
    } else if (Number.isNaN(tsDate)) {
      rowIssues.push({
        rowIndex,
        code: "NULL_TIMESTAMP",
        severity: "error",
        message: `Timestamp "${timestamp}" is not a parseable date.`,
      });
    } else {
      const now = Date.now();
      if (tsDate > now + FUTURE_TOLERANCE_MS) {
        rowIssues.push({
          rowIndex,
          code: "FUTURE_TIMESTAMP",
          severity: "error",
          message: `Timestamp ${timestamp} is in the future.`,
        });
      } else if (tsDate < now - STALE_AFTER_MS) {
        rowIssues.push({
          rowIndex,
          code: "STALE_TIMESTAMP",
          severity: "info",
          message: `Timestamp ${timestamp} is more than 30 days old.`,
        });
      }
    }

    // Device ID
    if (EMPTY(get(1))) {
      rowIssues.push({
        rowIndex,
        code: "NULL_DEVICE_ID",
        severity: "error",
        message: "Device ID is empty.",
      });
    }

    // CPU / memory
    if (cpuNum === null || cpuNum < 0 || cpuNum > 100) {
      rowIssues.push({
        rowIndex,
        code: "INVALID_CPU",
        severity: "error",
        message: `CPU usage "${get(10) ?? ""}" is not a number in [0, 100].`,
      });
    }
    if (memNum === null || memNum < 0 || memNum > 100) {
      rowIssues.push({
        rowIndex,
        code: "INVALID_MEM",
        severity: "error",
        message: `Memory usage "${get(11) ?? ""}" is not a number in [0, 100].`,
      });
    }

    // Energy / carbon
    if (energyNum === null || energyNum < 0) {
      rowIssues.push({
        rowIndex,
        code: "NEGATIVE_ENERGY",
        severity: "error",
        message: `Energy "${get(8) ?? ""}" is negative or non-numeric.`,
      });
    }
    if (carbonNum === null || carbonNum < 0) {
      rowIssues.push({
        rowIndex,
        code: "NEGATIVE_CARBON",
        severity: "error",
        message: `Carbon "${get(9) ?? ""}" is negative or non-numeric.`,
      });
    }

    // Enumerated fields
    const knownClasses: string[] = Object.values(DeviceClass);
    if (!knownClasses.includes(deviceClass)) {
      rowIssues.push({
        rowIndex,
        code: "UNKNOWN_DEVICE_CLASS",
        severity: "warning",
        message: `Device class "${deviceClass || "(empty)"}" is not one of ${knownClasses.join(", ")}.`,
      });
    }
    const knownOs: string[] = Object.values(DeviceOs);
    if (!knownOs.includes(os)) {
      rowIssues.push({
        rowIndex,
        code: "UNKNOWN_OS",
        severity: "warning",
        message: `OS "${os || "(empty)"}" is not one of ${knownOs.join(", ")}.`,
      });
    }
    const knownModels: string[] = Object.values(AttributionModel);
    if (!knownModels.includes(attributionModel)) {
      rowIssues.push({
        rowIndex,
        code: "UNKNOWN_ATTRIBUTION",
        severity: "warning",
        message: `Attribution model "${attributionModel || "(empty)"}" is not one of ${knownModels.join(", ")}.`,
      });
    }

    // Fleet assignment consistency
    if (fleetId === null && fleetName === null) {
      rowIssues.push({
        rowIndex,
        code: "NULL_FLEET_MISMATCH",
        severity: "warning",
        message: "Device has no fleet assignment (Fleet ID and Fleet Name are both empty).",
      });
    } else if (fleetId === null || fleetName === null) {
      rowIssues.push({
        rowIndex,
        code: "NULL_FLEET_MISMATCH",
        severity: "warning",
        message: `Fleet fields are inconsistent — Fleet ID=${fleetId ?? "(empty)"}, Fleet Name=${fleetName ?? "(empty)"}.`,
      });
    }

    // Grid region
    if (gridRegion === null) {
      rowIssues.push({
        rowIndex,
        code: "GRID_REGION_MISSING",
        severity: "warning",
        message: "Grid region is empty.",
      });
    }

    const row: TelemetryRow = {
      rowIndex,
      timestamp,
      deviceId,
      deviceClass,
      os,
      hostname,
      fleetId,
      fleetName,
      gridRegion,
      energyWh: energyNum ?? 0,
      carbonG: carbonNum ?? 0,
      cpuUsagePct: cpuNum ?? 0,
      memoryUsagePct: memNum ?? 0,
      networkSentBytes: netSent ?? 0,
      networkReceivedBytes: netRecv ?? 0,
      deviceStatus,
      attributionModel,
    };
    rows.push(row);

    // Duplicates (after the row exists so messages reference the index).
    if (deviceId !== "" && timestamp !== "" && !Number.isNaN(tsDate)) {
      const key = `${timestamp}|${deviceId}`;
      const dups = seen.get(key) ?? [];
      if (dups.length > 0) {
        rowIssues.push({
          rowIndex,
          code: "DUPLICATE_ROW",
          severity: "warning",
          message: `Duplicate of row ${dups[0] + 1} — same timestamp and device ID.`,
        });
      }
      dups.push(rowIndex);
      seen.set(key, dups);
    }

    issues.push(...rowIssues);
  });

  return { rows, issues };
}

export function validateTelemetryRows(rows: TelemetryRow[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seen: Map<string, number[]> = new Map();

  rows.forEach((row, idx) => {
    const rowIssues: ValidationIssue[] = [];

    const tsDate = Date.parse(row.timestamp);
    if (row.timestamp.trim() === "") {
      rowIssues.push({ rowIndex: idx, code: "NULL_TIMESTAMP", severity: "error", message: "Timestamp is empty." });
    } else if (Number.isNaN(tsDate)) {
      rowIssues.push({ rowIndex: idx, code: "NULL_TIMESTAMP", severity: "error", message: `Timestamp "${row.timestamp}" is not a parseable date.` });
    } else {
      const now = Date.now();
      if (tsDate > now + FUTURE_TOLERANCE_MS) {
        rowIssues.push({ rowIndex: idx, code: "FUTURE_TIMESTAMP", severity: "error", message: `Timestamp ${row.timestamp} is in the future.` });
      } else if (tsDate < now - STALE_AFTER_MS) {
        rowIssues.push({ rowIndex: idx, code: "STALE_TIMESTAMP", severity: "info", message: `Timestamp ${row.timestamp} is more than 30 days old.` });
      }
    }

    if (row.deviceId.trim() === "") {
      rowIssues.push({ rowIndex: idx, code: "NULL_DEVICE_ID", severity: "error", message: "Device ID is empty." });
    }

    if (row.cpuUsagePct < 0 || row.cpuUsagePct > 100) {
      rowIssues.push({ rowIndex: idx, code: "INVALID_CPU", severity: "error", message: `CPU usage ${row.cpuUsagePct} is outside [0, 100].` });
    }
    if (row.memoryUsagePct < 0 || row.memoryUsagePct > 100) {
      rowIssues.push({ rowIndex: idx, code: "INVALID_MEM", severity: "error", message: `Memory usage ${row.memoryUsagePct} is outside [0, 100].` });
    }
    if (row.energyWh < 0) {
      rowIssues.push({ rowIndex: idx, code: "NEGATIVE_ENERGY", severity: "error", message: `Energy ${row.energyWh} is negative.` });
    }
    if (row.carbonG < 0) {
      rowIssues.push({ rowIndex: idx, code: "NEGATIVE_CARBON", severity: "error", message: `Carbon ${row.carbonG} is negative.` });
    }

    const knownClasses: string[] = Object.values(DeviceClass);
    if (!knownClasses.includes(row.deviceClass)) {
      rowIssues.push({ rowIndex: idx, code: "UNKNOWN_DEVICE_CLASS", severity: "warning", message: `Device class "${row.deviceClass}" is not one of ${knownClasses.join(", ")}.` });
    }
    const knownOs: string[] = Object.values(DeviceOs);
    if (!knownOs.includes(row.os)) {
      rowIssues.push({ rowIndex: idx, code: "UNKNOWN_OS", severity: "warning", message: `OS "${row.os}" is not one of ${knownOs.join(", ")}.` });
    }
    const knownModels: string[] = Object.values(AttributionModel);
    if (!knownModels.includes(row.attributionModel)) {
      rowIssues.push({ rowIndex: idx, code: "UNKNOWN_ATTRIBUTION", severity: "warning", message: `Attribution model "${row.attributionModel}" is not one of ${knownModels.join(", ")}.` });
    }

    if (row.fleetId === null && row.fleetName === null) {
      rowIssues.push({ rowIndex: idx, code: "NULL_FLEET_MISMATCH", severity: "warning", message: "Device has no fleet assignment (Fleet ID and Fleet Name are both empty)." });
    } else if (row.fleetId === null || row.fleetName === null) {
      rowIssues.push({ rowIndex: idx, code: "NULL_FLEET_MISMATCH", severity: "warning", message: `Fleet fields are inconsistent — Fleet ID=${row.fleetId ?? "(empty)"}, Fleet Name=${row.fleetName ?? "(empty)"}.` });
    }

    if (row.gridRegion === null) {
      rowIssues.push({ rowIndex: idx, code: "GRID_REGION_MISSING", severity: "warning", message: "Grid region is empty." });
    }

    if (row.deviceId !== "" && row.timestamp !== "" && !Number.isNaN(tsDate)) {
      const key = `${row.timestamp}|${row.deviceId}`;
      const dups = seen.get(key) ?? [];
      if (dups.length > 0) {
        rowIssues.push({ rowIndex: idx, code: "DUPLICATE_ROW", severity: "warning", message: `Duplicate of row ${dups[0] + 1} — same timestamp and device ID.` });
      }
      dups.push(idx);
      seen.set(key, dups);
    }

    issues.push(...rowIssues);
  });

  return issues;
}

export function computeQualityScore(issues: ValidationIssue[]): QualityScore {
  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;
  const infos = issues.filter((i) => i.severity === "info").length;
  const score = Math.max(0, Math.min(100, 100 - errors * 5 - warnings * 1));
  const zone: QualityScore["zone"] = score >= 80 ? "green" : score >= 60 ? "amber" : "red";
  return { score, zone, errors, warnings, infos };
}
