"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { useAnalyticsDevice } from "@/hooks/useAnalyticsDrilldown";
import { AreaChart } from "@/components/charts/AreaChart";
import { BarChart } from "@/components/charts/BarChart";
import { formatCarbonKg } from "@/utils/formatter";
import { ROUTES } from "@/constants/routes";
import {
  ArrowLeft,
  ArrowRight,
  Cpu,
  MemoryStick,
  Flame,
  Zap,
  Globe,
  Server,
  Activity,
  Leaf,
  Gauge,
  Boxes,
} from "lucide-react";

function formatHour(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, "0")}:00`;
}

function KpiCard({
  label,
  value,
  sub,
  icon,
  accent,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <div className="rounded-card border border-border bg-panel p-5">
      <div className="flex items-center justify-between text-text-muted mb-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-text-faint">
          {label}
        </span>
        <span className={accent}>{icon}</span>
      </div>
      <div className="font-mono text-xl font-bold text-text">{value}</div>
      {sub && <div className="mt-1 text-[11px] text-text-muted font-mono">{sub}</div>}
    </div>
  );
}

export default function AnalyticsDevicePage() {
  const params = useParams();
  const router = useRouter();
  const deviceId = typeof params.id === "string" ? params.id : null;

  const { data, loading, error, refetch } = useAnalyticsDevice(deviceId);

  if (loading || !data) {
    return <LoadingState label="Loading device emissions..." />;
  }
  if (error) {
    return <ErrorState message={error} onRetry={refetch} />;
  }

  const { device, carbon, workload, services } = data;
  const delta = carbon.delta_pct_vs_yesterday;
  const hasCarbonHistory = carbon.history.length >= 2;
  const hasWorkload = workload.hourly.length > 0;

  const hourlyLabels = workload.hourly.map((h, i) =>
    i % 4 === 0 || i === workload.hourly.length - 1 ? formatHour(h.hour) : ""
  );
  const hourlyCpu = workload.hourly.map((h) => h.cpu_avg);
  const hourlyMem = workload.hourly.map((h) => h.mem_avg);

  const backHref = device.fleet_id ? ROUTES.analyticsFleet(device.fleet_id) : ROUTES.analytics;
  const backLabel = device.fleet_id ? `Back to ${device.fleet_name}` : "Back to Analytics";

  return (
    <div className="space-y-8 animate-fade-in">
      <button
        onClick={() => router.push(backHref)}
        className="flex items-center gap-2 text-xs text-text-muted hover:text-accent transition-colors font-mono cursor-pointer"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>{backLabel}</span>
      </button>

      <PageHeader
        title={device.device_id}
        subtitle={
          device.hostname
            ? `${device.hostname} · ${device.device_class}${device.os ? ` · ${device.os}` : ""}`
            : `${device.device_class}${device.os ? ` · ${device.os}` : ""}`
        }
        badge={
          device.fleet_name
            ? `${device.fleet_name} · ${device.grid_region ?? "—"}`
            : "Unassigned"
        }
        action={
          <span
            className={`inline-flex items-center gap-1.5 rounded px-3 py-1 font-mono text-[11px] font-semibold ${
              device.status === "operating"
                ? "bg-accent/10 text-success border border-accent/30"
                : "bg-amber/10 text-amber border border-amber/30"
            }`}
          >
            {device.status === "operating" ? "● Live" : device.status}
          </span>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Carbon Today"
          value={formatCarbonKg(carbon.today_kg)}
          sub={
            <span
              className={
                delta > 0
                  ? "font-bold text-high"
                  : delta < 0
                  ? "font-bold text-success"
                  : "text-text-faint"
              }
            >
              {delta > 0 ? "▲" : delta < 0 ? "▼" : "—"} {Math.abs(delta).toFixed(1)}% vs yesterday
            </span>
          }
          icon={<Flame className="h-4 w-4" />}
          accent="text-high"
        />
        <KpiCard
          label="Live CPU"
          value={`${workload.current.cpu.toFixed(1)}%`}
          sub={`load avg ${workload.current.load_average_1m.toFixed(2)} · ${workload.current.process_count} procs`}
          icon={<Cpu className="h-4 w-4" />}
          accent="text-blue"
        />
        <KpiCard
          label="Live Memory"
          value={`${workload.current.mem.toFixed(1)}%`}
          sub="across current telemetry window"
          icon={<MemoryStick className="h-4 w-4" />}
          accent="text-blue"
        />
        <KpiCard
          label="Grid Profile"
          value={device.grid_intensity_g_per_kwh.toFixed(0)}
          sub={`${device.grid_region ?? "—"} · gCO2e/kWh`}
          icon={<Zap className="h-4 w-4" />}
          accent="text-amber"
        />
      </div>

      {/* Carbon history + hourly workload */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-card border border-border bg-panel p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-high" />
              <h2 className="font-display text-sm font-bold text-text">Carbon — Last 24h</h2>
            </div>
            <span className="font-mono text-[11px] text-text-faint">hourly buckets</span>
          </div>
          {hasCarbonHistory ? (
            <AreaChart values={carbon.history.map((h) => h.carbon_g)} />
          ) : (
            <div className="h-[180px] flex flex-col items-center justify-center text-text-faint font-mono text-xs space-y-2">
              <Activity className="h-6 w-6" />
              <span>Not enough hourly data yet — keep the agent running.</span>
            </div>
          )}
          {hasCarbonHistory && (
            <div className="flex justify-between font-mono text-[10px] text-text-faint">
              <span>{formatHour(carbon.history[0].hour)}</span>
              <span>{formatHour(carbon.history[carbon.history.length - 1].hour)}</span>
            </div>
          )}
        </div>

        <div className="rounded-card border border-border bg-panel p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-blue" />
              <h2 className="font-display text-sm font-bold text-text">Workload — Last 24h</h2>
            </div>
            <div className="flex items-center gap-3 font-mono text-[10px] text-text-faint">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm bg-[var(--clean)]" /> CPU
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm bg-[var(--moderate)]" /> MEM
              </span>
            </div>
          </div>
          {hasWorkload ? (
            <BarChart
              values={hourlyCpu}
              values2={hourlyMem}
              labels={hourlyLabels}
              maxValue={100}
            />
          ) : (
            <div className="h-[180px] flex flex-col items-center justify-center text-text-faint font-mono text-xs space-y-2">
              <Gauge className="h-6 w-6" />
              <span>No workload data yet.</span>
            </div>
          )}
          {hasWorkload && (
            <div className="flex justify-between font-mono text-[10px] text-text-faint">
              <span>{formatHour(workload.hourly[0].hour)}</span>
              <span>{formatHour(workload.hourly[workload.hourly.length - 1].hour)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Threshold vs budget */}
      <div className="rounded-card border border-border bg-panel p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Leaf className={`h-4 w-4 ${carbon.vs_threshold_pct >= 100 ? "text-high" : "text-success"}`} />
            <h2 className="font-display text-sm font-bold text-text">
              Daily Carbon Budget Position
            </h2>
          </div>
          <span className="font-mono text-xs text-text-faint">
            {carbon.today_kg.toFixed(2)} kg of {carbon.daily_limit_kg} kg org limit
          </span>
        </div>
        <div className="relative h-3 w-full rounded bg-bg">
          <div
            className={`h-full rounded transition-colors ${
              carbon.vs_threshold_pct >= 100 ? "bg-high" : "bg-accent"
            }`}
            style={{ width: `${Math.min(100, carbon.vs_threshold_pct)}%` }}
          />
          <div
            className="absolute top-[-4px] h-[20px] w-0.5 bg-amber"
            style={{ left: `${Math.min(100, carbon.vs_threshold_pct)}%` }}
            title="today's position"
          />
        </div>
        <p className="text-[11px] text-text-muted">
          This device accounts for{" "}
          <span className="font-bold text-text">{carbon.vs_threshold_pct}%</span> of the
          organization&apos;s daily carbon budget of {carbon.daily_limit_kg} kg.
        </p>
      </div>

      {/* Services breakdown */}
      <div className="rounded-card border border-border bg-panel p-6 space-y-5">
        <div className="flex items-center gap-2 border-b border-border pb-4">
          <Boxes className="h-4 w-4 text-accent" />
          <h2 className="font-display text-sm font-bold text-text">Per-Service Attribution</h2>
          <span className="ml-auto font-mono text-[11px] text-text-faint">
            share of today&apos;s carbon
          </span>
        </div>

        {services.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-6 text-text-faint font-mono text-xs text-center">
            <Boxes className="h-6 w-6" />
            <span>
              No service-level attribution yet — agent service mapping is not enabled on this
              device.
            </span>
          </div>
        ) : (
          <div className="space-y-4 font-mono text-xs">
            {services.map((s) => (
              <div key={s.service}>
                <div className="flex justify-between mb-1">
                  <span className="text-text font-medium truncate max-w-[60%]" title={s.service}>
                    {s.service}
                  </span>
                  <span className="text-text-faint shrink-0">
                    {s.carbon_g >= 1000
                      ? `${(s.carbon_g / 1000).toFixed(2)} kg`
                      : `${s.carbon_g.toFixed(1)} g`}{" "}
                    <span className="font-bold text-text">({s.pct}%)</span>
                  </span>
                </div>
                <div className="h-2 w-full rounded bg-bg">
                  <div
                    className="h-full rounded bg-accent"
                    style={{ width: `${Math.min(100, s.pct)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Live state footer */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-card border border-border bg-panel p-4 flex items-center gap-3">
          <Server className="h-4 w-4 text-accent shrink-0" />
          <div className="text-xs">
            <div className="text-text-faint uppercase tracking-wider text-[10px] font-semibold">Power Model</div>
            <div className="font-mono text-text font-bold mt-0.5">
              TDP {device.rated_tdp_w}W · base {device.base_power_w}W
            </div>
          </div>
        </div>
        <div className="rounded-card border border-border bg-panel p-4 flex items-center gap-3">
          <Activity className="h-4 w-4 text-success shrink-0" />
          <div className="text-xs">
            <div className="text-text-faint uppercase tracking-wider text-[10px] font-semibold">Last Seen</div>
            <div className="font-mono text-text font-bold mt-0.5">
              {device.last_seen_at
                ? new Date(device.last_seen_at).toLocaleTimeString()
                : "—"}
            </div>
          </div>
        </div>
        <div className="rounded-card border border-border bg-panel p-4 flex items-center gap-3">
          <Globe className="h-4 w-4 text-amber shrink-0" />
          <div className="text-xs">
            <div className="text-text-faint uppercase tracking-wider text-[10px] font-semibold">
              Fleet
            </div>
            {device.fleet_name ? (
              <Link
                href={ROUTES.analyticsFleet(device.fleet_id as number)}
                className="font-mono text-text font-bold mt-0.5 text-accent hover:underline inline-flex items-center gap-1"
              >
                {device.fleet_name}
                <ArrowRight className="h-3 w-3" />
              </Link>
            ) : (
              <div className="font-mono text-text font-bold mt-0.5">Unassigned</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
