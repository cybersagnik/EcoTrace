"use client";

import Link from "next/link";
import { PageHeader } from "@/components/shared/PageHeader";
import { useAnalytics } from "@/hooks/useAnalytics";
import { useAnalyticsFleets } from "@/hooks/useAnalyticsDrilldown";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { formatCarbonKg } from "@/utils/formatter";
import { ROUTES } from "@/constants/routes";
import { BarChart3, Zap, Leaf, Globe, ArrowRight, AlertTriangle } from "lucide-react";

function DeltaPill({ delta, suffix = "vs yesterday" }: { delta: number; suffix?: string }) {
  const up = delta > 0;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-mono text-[10px] font-semibold ${
        up
          ? "bg-high/10 text-high border border-high/30"
          : delta === 0
          ? "bg-elevated text-text-faint border border-border"
          : "bg-accent/10 text-success border border-accent/30"
      }`}
    >
      {up ? "▲" : delta === 0 ? "—" : "▼"} {Math.abs(delta).toFixed(1)}% {suffix}
    </span>
  );
}

function IntensityPill({ gPerKwh }: { gPerKwh: number }) {
  const label = gPerKwh >= 600 ? "high" : gPerKwh >= 350 ? "moderate" : "clean";
  return (
    <span
      className={`rounded px-2 py-0.5 font-mono text-[10px] font-semibold ${
        label === "clean"
          ? "bg-accent/10 text-success border border-accent/30"
          : label === "moderate"
          ? "bg-amber/10 text-amber border border-amber/30"
          : "bg-high/10 text-high border border-high/30"
      }`}
    >
      {label} grid
    </span>
  );
}

export default function AnalyticsPage() {
  const { data, loading, error, refetch } = useAnalytics();
  const drill = useAnalyticsFleets();

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
        <div className="rounded-card border border-border bg-panel p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-text-faint mb-2">
            Scope 1 & 2 Emissions
          </div>
          <div className="font-mono text-3xl font-bold text-text">
            {data.scope_emissions_kg.toLocaleString()} kg
          </div>
          <div className="mt-2 text-xs text-success font-mono">
            ↓ {Math.abs(data.delta_pct)}% vs last month
          </div>
        </div>

        <div className="rounded-card border border-border bg-panel p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-text-faint mb-2">
            Peak Intensity Hour
          </div>
          <div className="font-mono text-3xl font-bold text-amber">{data.peak_window}</div>
          <div className="mt-2 text-xs text-text-muted">High thermal grid load window</div>
        </div>

        <div className="rounded-card border border-border bg-panel p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-text-faint mb-2">
            Carbon Offset Saved
          </div>
          <div className="font-mono text-3xl font-bold text-success">
            {data.offset_saved_kg} kg
          </div>
          <div className="mt-2 text-xs text-success font-mono">
            Equivalent to {data.equivalent_trees} trees
          </div>
        </div>
      </div>

      {/* Energy Source Mix Breakdown */}
      <div className="rounded-card border border-border bg-panel p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <h2 className="font-display text-base font-bold text-text">Energy Generation Mix</h2>
            <p className="text-xs text-text-muted">Real-time breakdown of power sources fueling active workloads.</p>
          </div>
          <span className="font-mono text-xs text-success">{data.clean_pct}% Clean Energy</span>
        </div>

        <div className="space-y-4 font-mono text-xs">
          {data.mix.map((item) => (
            <div key={item.source}>
              <div className="flex justify-between mb-1">
                <span className="text-text font-medium flex items-center gap-2">
                  {item.type === "clean" ? (
                    <Leaf className="h-3.5 w-3.5 text-success" />
                  ) : item.type === "hydro" ? (
                    <Zap className="h-3.5 w-3.5 text-blue" />
                  ) : (
                    <BarChart3 className="h-3.5 w-3.5 text-amber" />
                  )}
                  {item.source}
                </span>
                <span
                  className={
                    item.type === "clean"
                      ? "text-success font-bold"
                      : item.type === "hydro"
                      ? "text-blue font-bold"
                      : "text-amber font-bold"
                  }
                >
                  {item.pct}% ({item.kwh.toLocaleString()} kWh)
                </span>
              </div>
              <div className="h-2.5 w-full rounded bg-bg">
              <div
                className={`h-full rounded ${
                  item.type === "clean"
                    ? "bg-accent"
                    : item.type === "hydro"
                    ? "bg-accent"
                    : "bg-amber"
                }`}
                style={{ width: `${item.pct}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>

    {/* Fleet Emissions Breakdown — drill-down into per-fleet and per-device carbon */}
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-base font-bold text-text">
            Fleet Emissions Breakdown
          </h2>
          <p className="text-xs text-text-muted">
            Drill down from org → fleet → device to see exactly where carbon is being emitted today.
          </p>
        </div>
        {drill.loading && (
          <span className="font-mono text-xs text-text-faint">loading…</span>
        )}
      </div>

      {drill.error ? (
        <div className="rounded border border-amber/30 bg-amber/5 p-5 space-y-2">
          <p className="text-xs text-amber font-semibold">
            Could not load fleet breakdown
          </p>
          <p className="text-[11px] text-text-muted">{drill.error}</p>
          <button
            onClick={drill.refetch}
            className="rounded border border-border px-3 py-1.5 font-mono text-xs font-semibold text-text-muted hover:text-text cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : drill.data ? (
        <>
          {/* Org total vs daily budget */}
          <div className="rounded-card border border-border bg-panel p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap
                  className={`h-4 w-4 ${drill.data.totals.threshold_exceeded ? "text-high" : "text-success"}`}
                />
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-text-faint">
                  Org Emissions Today vs Budget
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm font-bold text-text">
                  {formatCarbonKg(drill.data.totals.carbon_kg_today)}
                </span>
                <span className="font-mono text-[11px] text-text-faint">
                  of {drill.data.totals.daily_limit_kg} kg limit
                </span>
              </div>
            </div>

            <div className="relative h-3 w-full rounded bg-bg">
              <div
                className={`h-full rounded transition-colors ${
                  drill.data.totals.threshold_exceeded ? "bg-high" : "bg-accent"
                }`}
                style={{ width: `${Math.min(100, drill.data.totals.threshold_pct)}%` }}
              />
            </div>
            <div className="flex items-center justify-between font-mono text-[11px]">
              <span className="text-text-muted">
                {drill.data.totals.active_devices} active device
                {drill.data.totals.active_devices === 1 ? "" : "s"} ·{" "}
                {drill.data.totals.energy_wh_today.toFixed(1)} kWh today
              </span>
              <span
                className={
                  drill.data.totals.threshold_exceeded
                    ? "font-bold text-high"
                    : "font-bold text-success"
                }
              >
                {drill.data.totals.threshold_pct}% of budget
              </span>
            </div>
          </div>

          {/* Per-fleet cards */}
          {drill.data.fleets.length === 0 ? (
            <div className="rounded border-2 border-dashed border-border bg-panel p-8 text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded bg-elevated text-text-faint">
                <Globe className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-text">No fleets configured yet</p>
                <p className="text-xs text-text-muted">
                  Create a fleet and assign devices to see per-fleet carbon here. Unassigned
                  devices are aggregated below.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {drill.data.fleets.map((f) => (
                <Link
                  key={f.id}
                  href={ROUTES.analyticsFleet(f.id)}
                  className="group rounded-card border border-border bg-panel p-5 hover:border-accent/40 transition-colors flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <Globe className="h-4 w-4 text-accent shrink-0" />
                      <span className="font-mono text-sm font-bold text-text truncate" title={f.name}>
                        {f.name}
                      </span>
                    </div>
                    <IntensityPill gPerKwh={f.grid_intensity_g_per_kwh} />
                  </div>

                  <div className="space-y-2 font-mono text-xs bg-bg/60 p-3 rounded">
                    <div className="flex justify-between">
                      <span className="text-text-faint">Region:</span>
                      <span className="font-bold text-text">{f.grid_region}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-faint">Carbon today:</span>
                      <span className="font-bold text-text">{formatCarbonKg(f.carbon_kg_today)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-text-faint">Devices:</span>
                      <span className="font-bold text-text">
                        {f.active_devices} / {f.total_devices} live
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-border pt-3">
                    <DeltaPill delta={f.delta_pct_vs_yesterday} />
                    <span className="flex items-center gap-1 text-accent font-mono text-[11px] font-semibold group-hover:underline cursor-pointer">
                      <span>Drill down</span>
                      <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Unassigned bucket */}
          {drill.data.unassigned.carbon_kg_today > 0 && (
            <div className="rounded-card border border-amber/30 bg-amber/5 p-5 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-mono text-xs font-semibold text-amber">
                    Unassigned devices —{" "}
                    {drill.data.unassigned.active_devices} active ·{" "}
                    {formatCarbonKg(drill.data.unassigned.carbon_kg_today)} today
                  </p>
                  <p className="text-[11px] text-text-muted">
                    These devices are emitting outside any fleet. Assign them from{" "}
                    <Link href="/fleet" className="text-accent hover:underline font-semibold">
                      Fleet Registry
                    </Link>{" "}
                    to include them in fleet-level analytics.
                  </p>
                </div>
              </div>
              <span className="flex items-center gap-1 font-mono text-[11px] font-bold text-amber shrink-0">
                {drill.data.unassigned.delta_pct_vs_yesterday > 0 ? "▲" : "▼"}{" "}
                {Math.abs(drill.data.unassigned.delta_pct_vs_yesterday).toFixed(1)}% vs yesterday
              </span>
            </div>
          )}
        </>
      ) : null}
    </div>
  </div>
  );
}
