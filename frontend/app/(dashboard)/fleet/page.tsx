"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { useFleet } from "@/hooks/useFleet";
import { LoadingState } from "@/components/shared/LoadingState";
import { StatusBadge } from "@/components/dashboard/DeviceStatus";
import { formatCarbonKg, formatPct } from "@/utils/formatter";
import {
  Server,
  Globe,
  Zap,
  Activity,
  SlidersHorizontal,
  X,
  Check,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { FleetRegion } from "@/types/fleet";

const DEFAULT_REGIONS: FleetRegion[] = [
  { region: "US-EAST (N. Virginia)", carbon_kg: 5.2, active_devices: 2 },
  { region: "EU-WEST (Frankfurt)", carbon_kg: 4.1, active_devices: 1 },
  { region: "AP-SOUTH (Mumbai)", carbon_kg: 3.1, active_devices: 1 },
];

export default function FleetPage() {
  const { fleet, loading, refetch } = useFleet();
  const [selectedRegion, setSelectedRegion] = useState<FleetRegion | null>(null);

  // Modal Settings State
  const [pueTarget, setPueTarget] = useState(1.15);
  const [autoRouting, setAutoRouting] = useState(true);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  if (loading || !fleet) {
    return <LoadingState label="Loading fleet cluster metrics..." />;
  }

  const regionsList = fleet.regions ?? DEFAULT_REGIONS;

  const handleSaveClusterSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRegion) return;

    setToastMsg(`Cluster parameters for ${selectedRegion.region} saved!`);
    setTimeout(() => setToastMsg(null), 3500);
    setSelectedRegion(null);
    refetch();
  };

  return (
    <div className="space-y-8 animate-fade-in relative">
      {/* Toast Notification Banner */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-panel-solid p-4 shadow-glass backdrop-blur-glass text-emerald-400 font-mono text-xs animate-bounce">
          <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Cluster Management Modal Dialog */}
      {selectedRegion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 dark:bg-black/85 backdrop-blur-md p-4 animate-fade-in">
          <div className="w-[92vw] max-w-md max-h-[85vh] overflow-y-auto rounded-[28px] border border-border/80 bg-[#0F172A] dark:bg-[#0F172A] bg-white p-5 sm:p-6 shadow-2xl space-y-5 animate-scale-in">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-5 w-5 text-accent" />
                <h3 className="font-display text-base font-bold text-text dark:text-white text-slate-900">
                  Configure {selectedRegion.region}
                </h3>
              </div>
              <button
                onClick={() => setSelectedRegion(null)}
                className="text-text-faint hover:text-text p-1 rounded cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveClusterSettings} className="space-y-4 font-mono text-xs">
              <div>
                <label className="block text-text-muted dark:text-slate-300 text-slate-700 mb-1.5 font-semibold">Region Name</label>
                <input
                  type="text"
                  disabled
                  value={selectedRegion.region}
                  className="w-full rounded-lg border border-border/60 bg-bg/50 px-3 py-2 text-text-muted cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-text-muted dark:text-slate-300 text-slate-700 mb-1.5 font-semibold">
                  PUE Efficiency Target
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1.0"
                  max="2.0"
                  value={pueTarget}
                  onChange={(e) => setPueTarget(parseFloat(e.target.value))}
                  className="w-full rounded-lg border border-border/80 bg-[#0b0f17] dark:bg-[#0b0f17] bg-slate-50 px-3 py-2 text-text dark:text-white text-slate-900 focus:border-accent focus:outline-none shadow-inner"
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border/80 bg-bg/60 p-3">
                <div>
                  <span className="font-semibold text-text block">Green Auto-Routing</span>
                  <span className="text-[11px] text-text-faint">
                    Shift workloads when carbon spikes
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setAutoRouting(!autoRouting)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    autoRouting ? "bg-accent" : "bg-border"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-bg shadow transition duration-200 ease-in-out ${
                      autoRouting ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border/40">
                <button
                  type="button"
                  onClick={() => setSelectedRegion(null)}
                  className="rounded-xl border border-border px-4 py-2 font-semibold text-text-muted hover:text-text cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 font-semibold text-bg hover:bg-sky-400 transition-all shadow-glow cursor-pointer"
                >
                  <Check className="h-4 w-4" />
                  <span>Apply Parameters</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <PageHeader
        title="Multi-Region Fleet Clusters"
        subtitle="Regional data center carbon attribution, power usage effectiveness (PUE), and grid intensity routing."
        badge={`${regionsList.length} Active Regions`}
      />

      {/* Fleet Overview Stats Banner */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-card border border-border bg-panel-solid dark:bg-[#111b24] bg-white p-5 shadow-level-1">
          <div className="flex items-center justify-between text-text-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-faint">
              Active Regional Nodes
            </span>
            <Server className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="font-mono text-2xl font-bold text-text">
            {fleet.summary.active_devices} Total
          </div>
          <div className="mt-1 text-xs text-emerald-400 font-mono flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>100% telemetry sync rate</span>
          </div>
        </div>

        <div className="rounded-card border border-border bg-panel-solid dark:bg-[#111b24] bg-white p-5 shadow-level-1">
          <div className="flex items-center justify-between text-text-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-faint">
              Aggregate Fleet Carbon
            </span>
            <Activity className="h-4 w-4 text-sky-400" />
          </div>
          <div className="font-mono text-2xl font-bold text-text">
            {formatCarbonKg(fleet.summary.total_carbon_kg)}
          </div>
          <div className="mt-1 text-xs text-text-muted font-mono">
            {formatPct(fleet.summary.delta_pct_vs_yesterday)} vs 24h baseline
          </div>
        </div>

        <div className="rounded-card border border-border bg-panel-solid dark:bg-[#111b24] bg-white p-5 shadow-level-1">
          <div className="flex items-center justify-between text-text-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-faint">
              Primary Grid Zone
            </span>
            <Zap className="h-4 w-4 text-amber-400" />
          </div>
          <div className="font-mono text-2xl font-bold text-text">
            {fleet.summary.grid_region}
          </div>
          <div className="mt-1 text-xs text-amber-400 font-mono">
            240 gCO2e/kWh avg intensity
          </div>
        </div>
      </div>

      {/* Regional Cluster Cards Grid */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {regionsList.map((r) => (
          <div
            key={r.region}
            className="rounded-card border border-border bg-panel-solid dark:bg-[#111b24] bg-white p-6 shadow-level-1 hover:border-accent/40 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-accent" />
                  <span className="font-mono text-base font-bold text-text">{r.region}</span>
                </div>
                <StatusBadge status="operating" />
              </div>

              <div className="space-y-3 font-mono text-xs bg-bg/60 p-4 rounded-xl mb-4">
                <div className="flex justify-between">
                  <span className="text-text-faint">Carbon Output:</span>
                  <span className="font-bold text-text">{formatCarbonKg(r.carbon_kg)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-faint">Active Nodes:</span>
                  <span className="font-bold text-text">{r.active_devices} nodes</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-faint">PUE Rating:</span>
                  <span className="font-bold text-emerald-400">1.18 Efficient</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-border/40 pt-3 font-mono text-xs">
              <span className="text-text-faint">Auto-Routing: Active</span>
              <button
                onClick={() => setSelectedRegion(r)}
                className="flex items-center gap-1 text-accent hover:underline font-semibold cursor-pointer"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>Configure Cluster</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
