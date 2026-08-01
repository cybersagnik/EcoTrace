import { NextResponse } from "next/server";
import { Recommendation } from "@/types/recommendation";
import { checkRateLimit } from "@/lib/rateLimit";

const mockRecommendations: Recommendation[] = [
  {
    id: "reco-01",
    title: "Shift Heavy Compute to EU-West (Frankfurt)",
    description: "EU-West grid carbon intensity is currently 82% wind & solar (98 gCO2e/kWh vs 240 gCO2e/kWh in US-East). Auto-routing workloads will save 18.4 kg CO2e daily.",
    impact_kg: 18.4,
    region: "EU-West",
    priority: "critical",
    action_label: "Execute Load Shift",
  },
  {
    id: "reco-02",
    title: "Initiate Solar Battery Storage Discharge",
    description: "Datacenter battery reserves are 100% charged. Discharging during 18:00-20:00 peak grid load cuts Scope 2 carbon footprint.",
    impact_kg: 14.2,
    region: "US-East",
    priority: "high",
    action_label: "Trigger Battery Discharge",
  },
  {
    id: "reco-03",
    title: "Throttle High-Intensity Workstation (ws-win-audrey)",
    description: "Device ws-win-audrey is consuming 412.1g CO2e/hr (Top Emitter). Enabling dynamic power management caps consumption below 250g.",
    impact_kg: 8.6,
    region: "US-East",
    priority: "medium",
    action_label: "Apply Eco Profile",
  },
];

export async function GET(request: Request) {
  const rl = checkRateLimit(request);
  if (!rl.success && rl.response) return rl.response;

  return NextResponse.json({
    recommendations: mockRecommendations,
    total_potential_savings_kg: 41.2,
    last_computed: new Date().toISOString(),
  });
}
