/**
 * Display formatting helpers for the QA Dashboard.
 */

export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US");
}

export function formatCarbonGrams(g: number): string {
  if (g >= 1_000_000) return `${(g / 1_000_000).toFixed(2)} t CO2e`;
  if (g >= 1_000) return `${(g / 1_000).toFixed(2)} kg CO2e`;
  return `${g.toFixed(1)} g CO2e`;
}

export function formatEnergyWh(wh: number): string {
  if (wh >= 1_000_000) return `${(wh / 1_000_000).toFixed(2)} MWh`;
  if (wh >= 1_000) return `${(wh / 1_000).toFixed(2)} kWh`;
  return `${wh.toFixed(0)} Wh`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes)) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = bytes;
  let unit = 0;
  while (v >= 1024 && unit < units.length - 1) {
    v /= 1024;
    unit += 1;
  }
  return `${v.toFixed(v >= 100 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export function formatPct(v: number): string {
  if (!Number.isFinite(v)) return "—";
  return `${v.toFixed(1)}%`;
}

export function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts || "—";
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateShort(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts || "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatClock(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts || "—";
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}
