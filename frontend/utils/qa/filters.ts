import { FilterState, TelemetryRow } from "@/types/telemetry";

export const EMPTY_FILTERS: FilterState = {
  deviceIds: [],
  fleetIds: [],
  regions: [],
  statuses: [],
  dateFrom: null,
  dateTo: null,
};

const arrayParam = (v: string[]): string => (v.length > 0 ? v.join(",") : "");
const parseArray = (v: string | null): string[] =>
  v ? v.split(",").map((s) => s.trim()).filter(Boolean) : [];

export function serializeFilters(f: FilterState): string {
  const params = new URLSearchParams();
  const devices = arrayParam(f.deviceIds);
  const fleets = arrayParam(f.fleetIds);
  const regions = arrayParam(f.regions);
  const statuses = arrayParam(f.statuses);
  if (devices) params.set("device", devices);
  if (fleets) params.set("fleet", fleets);
  if (regions) params.set("region", regions);
  if (statuses) params.set("status", statuses);
  if (f.dateFrom) params.set("from", f.dateFrom);
  if (f.dateTo) params.set("to", f.dateTo);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function deserializeFilters(search: string): FilterState {
  const params = new URLSearchParams(search);
  const dateFrom = params.get("from");
  const dateTo = params.get("to");
  return {
    deviceIds: parseArray(params.get("device")),
    fleetIds: parseArray(params.get("fleet")),
    regions: parseArray(params.get("region")),
    statuses: parseArray(params.get("status")),
    dateFrom: dateFrom && dateFrom.length > 0 ? dateFrom : null,
    dateTo: dateTo && dateTo.length > 0 ? dateTo : null,
  };
}

export function applyFilters(rows: TelemetryRow[], f: FilterState): TelemetryRow[] {
  return rows.filter((row) => {
    if (f.deviceIds.length > 0 && !f.deviceIds.includes(row.deviceId)) return false;
    if (f.fleetIds.length > 0) {
      const fleetKey = row.fleetId ?? row.fleetName ?? "Unassigned";
      if (!f.fleetIds.includes(fleetKey)) return false;
    }
    if (f.regions.length > 0 && !f.regions.includes(row.gridRegion ?? "Unassigned")) return false;
    if (f.statuses.length > 0 && !f.statuses.includes(row.deviceStatus)) return false;

    const ts = Date.parse(row.timestamp);
    if (!Number.isNaN(ts)) {
      if (f.dateFrom) {
        const from = Date.parse(`${f.dateFrom}T00:00:00`);
        if (!Number.isNaN(from) && ts < from) return false;
      }
      if (f.dateTo) {
        const to = Date.parse(`${f.dateTo}T23:59:59.999`);
        if (!Number.isNaN(to) && ts > to) return false;
      }
    }
    return true;
  });
}

export function getFilterOptions(rows: TelemetryRow[]): {
  deviceIds: string[];
  fleetIds: string[];
  regions: string[];
  statuses: string[];
} {
  const deviceIds = new Set<string>();
  const fleetIds = new Set<string>();
  const regions = new Set<string>();
  const statuses = new Set<string>();

  rows.forEach((row) => {
    if (row.deviceId) deviceIds.add(row.deviceId);
    const fleetKey = row.fleetId ?? row.fleetName ?? "Unassigned";
    if (fleetKey) fleetIds.add(fleetKey);
    regions.add(row.gridRegion ?? "Unassigned");
    if (row.deviceStatus) statuses.add(row.deviceStatus);
  });

  const sort = (s: Set<string>): string[] => Array.from(s).sort((a, b) => a.localeCompare(b));
  return { deviceIds: sort(deviceIds), fleetIds: sort(fleetIds), regions: sort(regions), statuses: sort(statuses) };
}

export function filtersActive(f: FilterState): boolean {
  return (
    f.deviceIds.length > 0 ||
    f.fleetIds.length > 0 ||
    f.regions.length > 0 ||
    f.statuses.length > 0 ||
    f.dateFrom !== null ||
    f.dateTo !== null
  );
}
