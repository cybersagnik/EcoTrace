import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rateLimit";

export async function GET(request: Request) {
  const rl = checkRateLimit(request);
  if (!rl.success && rl.response) return rl.response;

  return NextResponse.json({
    scope_emissions_kg: 2840.4,
    delta_pct: -12.4,
    peak_window: "18:00 - 20:00",
    offset_saved_kg: 412.8,
    equivalent_trees: 18,
    clean_pct: 64.5,
    mix: [
      { source: "Solar & Wind", pct: 52.0, kwh: 1477, type: "clean" },
      { source: "Hydroelectric", pct: 12.5, kwh: 355, type: "clean" },
      { source: "Regional Thermal Grid", pct: 35.5, kwh: 1008, type: "thermal" },
    ],
    last_updated: new Date().toISOString(),
  });
}
