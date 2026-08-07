"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { useAnalyticsFleet } from "@/hooks/useAnalyticsDrilldown";
import { formatCarbonKg } from "@/utils/formatter";
import { ROUTES } from "@/constants/routes";
import { ArrowLeft, Globe, Zap, Server, Activity, ArrowRight, Flame, Cpu, MemoryStick } from "lucide-react";

export default function AnalyticsFleetPage() {
  const params = useParams();
  const router = useRouter();
  const fleetId = typeof params.id === "string" ? parseInt(params.id, 10) : null;

  const { data, loading, error, refetch } = useAnalyticsFleet(fleetId);

  if (loading || !data) {
    return <LoadingState label="Loading fleet emissions..." />;
  }
  if (error) {
    return <ErrorState message={error} onRetry={refetch} />;
  }

  const { fleet, summary, devices } = data;

  return (
    <div className="space-y-8 animate-fade-in">
      <button
        onClick={() => router.push(ROUTES.analytics)}
        className="flex items-center gap-2 text-xs text-text-muted hover:text-accent transition-colors font-mono cursor-pointer"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>Back to Analytics</span>
      </button>

      <PageHeader
        title={fleet.name}
        subtitle={fleet.description ?? `Fleet ID #${fleet.id} · ${fleet.grid_region}`}
        badge="Fleet Emissions"
      />

      {/* Fleet metadata */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-card border border-border bg-panel p-5">
          <div className="flex items-center justify-between text-text-muted mb-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-text-faint">
              Grid Region
            </span>
            <Globe className="h-4 w-4 text-accent" />
          </div>
          <div className="font-mono text-xl font-bold text-text">{fleet.grid_region}</div>
        </div>
        <div className="rounded-card border border-border bg-panel p-5">
          <div className="flex items-center justify-between text-text-muted mb-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-text-faint">
              Grid Intensity
            </span>
            <Zap className="h-4 w-4 text-amber" />
          </div>
          <div className="font-mono text-xl font-bold text-text">
            {fleet.grid_intensity_g_per_kwh.toFixed(0)}{" "}
            <span className="text-sm text-text-faint">gCO2e/kWh</span>
          </div>
        </div>
        <div className="rounded-card border border-border bg-panel p-5">
          <div className="flex items-center justify-between text-text-muted mb-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-text-faint">
              Carbon Today
            </span>
            <Flame className="h-4 w-4 text-high" />
          </div>
          <div className="font-mono text-xl font-bold text-text">
            {formatCarbonKg(summary.carbon_kg_today)}
          </div>
        </div>
        <div className="rounded-card border border-border bg-panel p-5">
          <div className="flex items-center justify-between text-text-muted mb-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-text-faint">
              Devices Online
            </span>
            <Server className="h-4 w-4 text-success" />
          </div>
          <div className="font-mono text-xl font-bold text-text">
            {summary.devices_online} <span className="text-sm text-text-faint">/ {summary.devices_total}</span>
          </div>
        </div>
      </div>

      {/* Devices in fleet */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-text">Devices in this Fleet</h2>
          <span className="font-mono text-xs text-text-faint">
            {summary.energy_wh_today.toFixed(1)} kWh today
          </span>
        </div>

        {devices.length === 0 ? (
          <div className="rounded border-2 border-dashed border-border bg-panel p-8 text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded bg-elevated text-text-faint">
              <Server className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-text">No devices in this fleet yet</p>
              <p className="text-xs text-text-muted">
                Assign devices from the Fleet Registry to see their emissions here.
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded border border-border bg-panel overflow-hidden">
            <table className="w-full text-left text-xs font-mono">
              <thead className="border-b border-border bg-elevated/40 text-text-faint uppercase">
                <tr>
                  <th className="px-5 py-3.5">Device</th>
                  <th className="px-5 py-3.5">Class</th>
                  <th className="px-5 py-3.5">CPU</th>
                  <th className="px-5 py-3.5">Memory</th>
                  <th className="px-5 py-3.5">Carbon Today</th>
                  <th className="px-5 py-3.5">Top Service</th>
                  <th className="px-5 py-3.5 text-right">Drill Down</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {devices.map((d) => (
                  <tr key={d.device_id} className="hover:bg-elevated/50">
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-text">{d.device_id}</div>
                      <div className="text-[10px] text-text-faint">{d.hostname ?? "—"}</div>
                    </td>
                    <td className="px-5 py-3.5 text-text-muted">{d.device_class}</td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1 text-text">
                        <Cpu className="h-3 w-3 text-blue" />
                        {d.cpu_avg.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1 text-text">
                        <MemoryStick className="h-3 w-3 text-blue" />
                        {d.mem_avg.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1 font-bold text-text">
                        <Flame className="h-3 w-3 text-high" />
                        {formatCarbonKg(d.carbon_g_today / 1000)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-text-muted">
                      {d.top_services.length > 0
                        ? `${d.top_services[0].service} (${(d.top_services[0].carbon_g / 1000).toFixed(2)} kg)`
                        : "—"}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        href={ROUTES.analyticsDevice(d.device_id)}
                        className="inline-flex items-center gap-1 rounded px-2.5 py-1.5 bg-accent/10 text-accent font-semibold hover:bg-accent/20 transition-colors"
                      >
                        <span>View</span>
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center gap-2 text-[11px] text-text-faint">
          <Activity className="h-3.5 w-3.5" />
          CPU and memory are today&apos;s averages across all telemetry windows.
        </div>
      </div>
    </div>
  );
}
