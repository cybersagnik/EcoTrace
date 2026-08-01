"use client";

import { useState, useEffect } from "react";
import { FleetSummary } from "@/types/fleet";
import { formatPct } from "@/utils/formatter";
import { formatIndiaTime } from "@/utils/date";
import { spectrumPosition } from "@/utils/calculations";
import { SkeletonFleetCard } from "@/components/shared/Skeleton";
import { NoDataState } from "@/components/shared/NoDataState";
import {
  TrendingDown,
  TrendingUp,
  Zap,
  Leaf,
  Clock,
  Activity,
} from "lucide-react";

interface FleetCardProps {
  summary?: FleetSummary | null;
  loading?: boolean;
  onRetry?: () => void;
}

export function FleetCard({ summary, loading = false, onRetry }: FleetCardProps) {
  const [lastUpdatedDisplay, setLastUpdatedDisplay] = useState<string>("");

  useEffect(() => {
    if (summary?.last_updated) {
      setLastUpdatedDisplay(formatIndiaTime(summary.last_updated));
    }
  }, [summary?.last_updated]);

  if (loading) {
    return <SkeletonFleetCard />;
  }

  if (!summary) {
    return <NoDataState message="No data — agent may be offline" onRetry={onRetry} />;
  }

  const isDown = summary.delta_pct_vs_yesterday < 0;
  const markerLeft = spectrumPosition(summary.total_carbon_kg);
  const totalCarbonG = summary.total_carbon_g ?? summary.total_carbon_kg * 1000;

  const timestampText =
    lastUpdatedDisplay || (summary.last_updated ? formatIndiaTime(summary.last_updated) : "06:18:44 PM");

  return (
    <div className="mb-6 sm:mb-8 grid grid-cols-1 gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {/* Stat Card 1: Total Fleet Carbon */}
      <div className="eco-card relative overflow-hidden rounded-[24px] border border-border bg-panel-solid dark:bg-[#0F172A] bg-white p-6 shadow-sm transition-all duration-300 ease-out hover:-translate-y-[6px] hover:shadow-md hover:border-[#16A34A]/40">
        <div className="flex items-center justify-between text-text-muted mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-text-faint">
            Total Carbon Output
          </span>
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#16A34A]/15 text-[#16A34A]">
            <Leaf className="h-4 w-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2 font-mono text-3xl font-bold text-text">
          {totalCarbonG.toLocaleString(undefined, { maximumFractionDigits: 1 })}
          <span className="text-sm font-normal text-[#22C55E] font-sans">g CO2e</span>
        </div>
        <div className="mt-1 text-xs text-text-faint font-mono">
          ({summary.total_carbon_kg.toFixed(1)} kg equivalent)
        </div>
        <div className="mt-3 flex items-center gap-1.5 font-mono text-xs">
          <span
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 font-semibold ${
              isDown
                ? "bg-[#22C55E]/15 text-[#22C55E] border border-[#22C55E]/30"
                : "bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/20"
            }`}
          >
            {isDown ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
            {formatPct(summary.delta_pct_vs_yesterday)}
          </span>
          <span className="text-text-faint">vs yesterday</span>
        </div>
      </div>

      {/* Stat Card 2: Active Devices */}
      <div className="eco-card relative overflow-hidden rounded-[24px] border border-border bg-panel-solid dark:bg-[#0F172A] bg-white p-6 shadow-sm transition-all duration-300 ease-out hover:-translate-y-[6px] hover:shadow-md hover:border-[#16A34A]/40">
        <div className="flex items-center justify-between text-text-muted mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-text-faint">
            Active Devices
          </span>
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#0EA5E9]/10 text-[#0EA5E9]">
            <Activity className="h-4 w-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2 font-mono text-3xl font-bold text-text">
          {summary.active_devices}
          <span className="text-sm font-normal text-[#22C55E] font-sans">
            nodes active
          </span>
        </div>
        <div className="mt-4 flex items-center gap-1.5 text-xs text-text-muted">
          <span className="h-2 w-2 rounded-full bg-[#22C55E] animate-pulse" />
          <span className="text-text-faint">Telemetry Stream Online</span>
        </div>
      </div>

      {/* Stat Card 3: Last Updated */}
      <div className="eco-card relative overflow-hidden rounded-[24px] border border-border bg-panel-solid dark:bg-[#0F172A] bg-white p-6 shadow-sm transition-all duration-300 ease-out hover:-translate-y-[6px] hover:shadow-md hover:border-[#16A34A]/40">
        <div className="flex items-center justify-between text-text-muted mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-text-faint">
            Last Updated
          </span>
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400">
            <Clock className="h-4 w-4" />
          </div>
        </div>
        <div className="font-mono text-2xl font-bold text-text">
          {timestampText}
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-text-muted font-mono">
          <span className="rounded-lg bg-indigo-500/15 px-2.5 py-1 font-semibold text-indigo-400 border border-indigo-500/30">
            India Time (IST)
          </span>
          <span className="rounded-lg bg-[#22C55E]/15 px-2.5 py-1 font-semibold text-[#22C55E] border border-[#22C55E]/30">
            Live
          </span>
        </div>
      </div>

      {/* Stat Card 4: Grid Region Intensity */}
      <div className="eco-card relative overflow-hidden rounded-[24px] border border-border bg-panel-solid dark:bg-[#0F172A] bg-white p-6 shadow-sm transition-all duration-300 ease-out hover:-translate-y-[6px] hover:shadow-md hover:border-[#16A34A]/40">
        <div className="flex items-center justify-between text-text-muted mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-text-faint">
            Grid Region Intensity
          </span>
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#F59E0B]/10 text-[#F59E0B]">
            <Zap className="h-4 w-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2 font-display text-2xl font-bold text-text">
          {summary.grid_region}
          <span className="rounded-lg bg-[#F59E0B]/15 px-2.5 py-1 font-mono text-xs font-semibold text-[#F59E0B] border border-[#F59E0B]/30">
            Moderate
          </span>
        </div>
        <div className="mt-3 text-xs text-text-muted flex items-center gap-1.5">
          <span className="font-mono text-text">240 gCO2e/kWh</span> avg grid mix
        </div>
      </div>

      {/* Spectrum Bar Across Bottom */}
      <div className="col-span-full eco-card rounded-[24px] border border-border bg-panel-solid dark:bg-[#0F172A] bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between text-xs font-medium text-text-muted mb-2">
          <span>Fleet Intensity Spectrum Gauge</span>
          <span className="font-mono text-success font-semibold">Clean Operating Zone</span>
        </div>
        <div className="relative h-2.5 w-full rounded-full bg-gradient-to-r from-[#4ADE80] via-amber-500 to-rose-500 shadow-inner">
          <div
            className="absolute -top-1 h-4 w-1.5 rounded-full bg-text shadow-md ring-2 ring-bg transition-all duration-300"
            style={{ left: `${markerLeft}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between font-mono text-[11px] text-text-faint">
          <span className="text-success font-semibold">Clean (&lt;150 kg)</span>
          <span className="text-amber-700 dark:text-amber-400 font-semibold">Moderate (150-300 kg)</span>
          <span className="text-rose-600 dark:text-rose-400 font-semibold">Intensive (&gt;300 kg)</span>
        </div>
      </div>
    </div>
  );
}
