import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rateLimit";

const mockFleetSummary = {
  total_carbon_kg: 12.4,
  total_carbon_g: 12400.0,
  delta_pct_vs_yesterday: -3.1,
  grid_region: "US-EAST",
  last_sync_seconds_ago: 30,
  last_updated: new Date().toISOString(),
  intensity: "moderate",
  active_devices: 4,
};

const mockTrend = [
  { day: "Mon", carbon_kg: 13.8 },
  { day: "Tue", carbon_kg: 14.2 },
  { day: "Wed", carbon_kg: 15.6 },
  { day: "Thu", carbon_kg: 16.9 },
  { day: "Fri", carbon_kg: 12.1 },
  { day: "Sat", carbon_kg: 10.4 },
  { day: "Sun", carbon_kg: 12.4 },
];

const mockHourlyTrend = Array.from({ length: 24 }, (_, i) => {
  const hourStr = `${i.toString().padStart(2, "0")}:00`;
  const baseEmissions = 350 + Math.sin((i / 24) * Math.PI * 2) * 150 + (i % 3) * 20;
  const roundedCarbonG = Math.round(baseEmissions * 10) / 10;
  return {
    hour: hourStr,
    carbon_g: roundedCarbonG,
    emissions_raw: Math.round(roundedCarbonG * 1.05 * 100) / 100,
  };
});

const mockRegions = [
  { region: "US-EAST (N. Virginia)", carbon_kg: 5.2, active_devices: 2 },
  { region: "EU-WEST (Frankfurt)", carbon_kg: 4.1, active_devices: 1 },
  { region: "AP-SOUTH (Mumbai)", carbon_kg: 3.1, active_devices: 1 },
];

export async function GET(request: Request) {
  const rl = checkRateLimit(request);
  if (!rl.success && rl.response) return rl.response;

  return NextResponse.json({
    summary: {
      ...mockFleetSummary,
      last_updated: new Date().toISOString(),
    },
    trend: mockTrend,
    hourly_trend: mockHourlyTrend,
    regions: mockRegions,
  });
}
