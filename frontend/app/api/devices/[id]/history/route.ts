import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rateLimit";

// Phase 2 real backend history endpoint mock/proxy
// In production, queries the Time Series DB / Data Platform §1
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const rl = checkRateLimit(request);
  if (!rl.success && rl.response) return rl.response;

  const deviceId = params.id;

  // Generate 24-point hourly history for the requested device
  const mockHistory = Array.from({ length: 24 }, (_, i) => {
    const hourStr = `${i.toString().padStart(2, "0")}:00`;
    // Add device specific seed variance
    const seed = deviceId.length * 12;
    const baseEmissions =
      220 +
      Math.sin(((i + seed) / 24) * Math.PI * 2) * 110 +
      (i % 3) * 15 +
      (seed % 50);
    const carbon_g = Math.round(baseEmissions * 10) / 10;
    return {
      hour: hourStr,
      timestamp: new Date(Date.now() - (23 - i) * 3600 * 1000).toISOString(),
      device_id: deviceId,
      carbon_g,
      emissions_raw: Math.round(carbon_g * 1.05 * 100) / 100,
    };
  });

  return NextResponse.json({
    device_id: deviceId,
    history: mockHistory,
  });
}
