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
      <div className="eco-card p-5">
        <div className="flex items-center justify-between text-text-muted mb-3">
          <span className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-text-muted">
            Total Carbon Output
          </span>
          <Leaf className="h-3.5 w-3.5 text-text-faint" />
        </div>
        <div className="flex items-baseline gap-2 font-mono text-[1.75rem] font-semibold text-text tabular-nums">
          {totalCarbonG.toLocaleString(undefined, { maximumFractionDigits: 1 })}
          <span className="text-sm font-normal text-success font-sans">g CO2e</span>
        </div>
        <div className="mt-1 text-xs text-text-muted font-mono tabular-nums">
          ({summary.total_carbon_kg.toFixed(1)} kg equivalent)
        </div>
        <div className="mt-3 flex items-center gap-1.5 font-mono text-xs">
          {isDown ? (
            <span className="inline-flex items-center gap-1 font-semibold text-success">
              <TrendingDown className="h-3 w-3" />
              {formatPct(summary.delta_pct_vs_yesterday)} ↓
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 font-semibold text-high">
              <TrendingUp className="h-3 w-3" />
              {formatPct(summary.delta_pct_vs_yesterday)} ↑
            </span>
          )}
          <span className="text-text-muted">vs yesterday</span>
        </div>
      </div>

      {/* Stat Card 2: Active Devices */}
      <div className="eco-card p-5">
        <div className="flex items-center justify-between text-text-muted mb-3">
          <span className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-text-muted">
            Active Devices
          </span>
          <Activity className="h-3.5 w-3.5 text-text-faint" />
        </div>
        <div className="flex items-baseline gap-2 font-mono text-[1.75rem] font-semibold text-text tabular-nums">
          {summary.active_devices}
          <span className="text-sm font-normal text-success font-sans">
            nodes active
          </span>
        </div>
        <div className="mt-4 flex items-center gap-1.5 text-xs text-text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          <span>Telemetry Stream Online</span>
        </div>
      </div>

      {/* Stat Card 3: Last Updated */}
      <div className="eco-card p-5">
        <div className="flex items-center justify-between text-text-muted mb-3">
          <span className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-text-muted">
            Last Updated
          </span>
          <Clock className="h-3.5 w-3.5 text-text-faint" />
        </div>
        <div className="font-mono text-[1.5rem] font-semibold text-text tabular-nums">
          {timestampText}
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-text-muted font-mono">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            India Time (IST)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            Live
          </span>
        </div>
      </div>

      {/* Stat Card 4: Grid Region Intensity */}
      <div className="eco-card p-5">
        <div className="flex items-center justify-between text-text-muted mb-3">
          <span className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-text-muted">
            Grid Region Intensity
          </span>
          <Zap className="h-3.5 w-3.5 text-text-faint" />
        </div>
        <div className="flex items-baseline gap-2 font-display text-[1.5rem] font-semibold text-text">
          {summary.grid_region}
          <span className="font-mono text-xs font-semibold text-moderate">
            Moderate
          </span>
        </div>
        <div className="mt-3 text-xs text-text-muted flex items-center gap-1.5">
          <span className="font-mono text-text tabular-nums">240 gCO2e/kWh</span> avg grid mix
        </div>
      </div>

      {/* Spectrum Bar Across Bottom */}
      <div className="col-span-full eco-card p-5">
        <div className="flex items-center justify-between text-xs font-medium text-text-muted mb-2">
          <span>Fleet Intensity Spectrum Gauge</span>
          <span className="font-mono text-success font-semibold">Clean Operating Zone</span>
        </div>
        <div className="relative h-1 w-full rounded-full bg-border">
          <div className="absolute -top-[3px] h-1.5 w-1.5 rounded-full bg-text border border-bg" style={{ left: `${markerLeft}%` }} />
        </div>
        <div className="mt-2 flex justify-between font-mono text-[11px] text-text-muted tabular-nums">
          <span className="text-success font-semibold">Clean (&lt;150 kg)</span>
          <span className="text-moderate font-semibold">Moderate (150-300 kg)</span>
          <span className="text-high font-semibold">Intensive (&gt;300 kg)</span>
        </div>
      </div>
    </div>
  );
}
