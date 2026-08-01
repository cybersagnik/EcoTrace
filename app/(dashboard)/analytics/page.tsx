"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { useAnalytics } from "@/hooks/useAnalytics";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { BarChart3, Zap, Leaf } from "lucide-react";

export default function AnalyticsPage() {
  const { data, loading, error, refetch } = useAnalytics();

  if (error) {
    return <ErrorState message={error} onRetry={refetch} />;
  }

  if (loading || !data) {
    return <LoadingState label="Loading carbon analytics..." />;
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Carbon Analytics & Intensity"
        subtitle="In-depth breakdown of energy source composition, Scope 1/2 emissions, and peak intensity windows."
        badge="GHG Protocol Standard"
      />

      {/* Analytics KPI Grid */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <div className="rounded-card border border-border bg-panel-solid dark:bg-[#111b24] bg-white p-5 shadow-level-1">
          <div className="text-xs font-semibold uppercase tracking-wider text-text-faint mb-2">
            Scope 1 & 2 Emissions
          </div>
          <div className="font-mono text-3xl font-bold text-text">
            {data.scope_emissions_kg.toLocaleString()} kg
          </div>
          <div className="mt-2 text-xs text-emerald-400 font-mono">
            ↓ {Math.abs(data.delta_pct)}% vs last month
          </div>
        </div>

        <div className="rounded-card border border-border bg-panel-solid dark:bg-[#111b24] bg-white p-5 shadow-level-1">
          <div className="text-xs font-semibold uppercase tracking-wider text-text-faint mb-2">
            Peak Intensity Hour
          </div>
          <div className="font-mono text-3xl font-bold text-amber-400">{data.peak_window}</div>
          <div className="mt-2 text-xs text-text-muted">High thermal grid load window</div>
        </div>

        <div className="rounded-card border border-border bg-panel-solid dark:bg-[#111b24] bg-white p-5 shadow-level-1">
          <div className="text-xs font-semibold uppercase tracking-wider text-text-faint mb-2">
            Carbon Offset Saved
          </div>
          <div className="font-mono text-3xl font-bold text-emerald-400">
            {data.offset_saved_kg} kg
          </div>
          <div className="mt-2 text-xs text-emerald-400 font-mono">
            Equivalent to {data.equivalent_trees} trees
          </div>
        </div>
      </div>

      {/* Energy Source Mix Breakdown */}
      <div className="rounded-card border border-border bg-panel-solid dark:bg-[#111b24] bg-white p-6 shadow-level-1 space-y-6">
        <div className="flex items-center justify-between border-b border-border/50 pb-4">
          <div>
            <h2 className="font-display text-base font-bold text-text">Energy Generation Mix</h2>
            <p className="text-xs text-text-muted">Real-time breakdown of power sources fueling active workloads.</p>
          </div>
          <span className="font-mono text-xs text-emerald-400">{data.clean_pct}% Clean Energy</span>
        </div>

        <div className="space-y-4 font-mono text-xs">
          {data.mix.map((item) => (
            <div key={item.source}>
              <div className="flex justify-between mb-1">
                <span className="text-text font-medium flex items-center gap-2">
                  {item.type === "clean" ? (
                    <Leaf className="h-3.5 w-3.5 text-emerald-400" />
                  ) : item.type === "hydro" ? (
                    <Zap className="h-3.5 w-3.5 text-sky-400" />
                  ) : (
                    <BarChart3 className="h-3.5 w-3.5 text-amber-400" />
                  )}
                  {item.source}
                </span>
                <span
                  className={
                    item.type === "clean"
                      ? "text-emerald-400 font-bold"
                      : item.type === "hydro"
                      ? "text-sky-400 font-bold"
                      : "text-amber-400 font-bold"
                  }
                >
                  {item.pct}% ({item.kwh.toLocaleString()} kWh)
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-bg">
                <div
                  className={`h-full rounded-full ${
                    item.type === "clean"
                      ? "bg-emerald-500"
                      : item.type === "hydro"
                      ? "bg-sky-400"
                      : "bg-amber-500"
                  }`}
                  style={{ width: `${item.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
