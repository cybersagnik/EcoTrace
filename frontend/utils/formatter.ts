export function formatCarbonKg(kg: number): string {
  return `${kg.toFixed(1)} kg CO2e`;
}

export function formatCarbonG(g: number): string {
  return `${g.toFixed(1)} g`;
}

export function formatPct(pct: number): string {
  return `${Math.abs(pct).toFixed(1)}%`;
}
