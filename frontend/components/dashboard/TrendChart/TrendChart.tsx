"use client";

import { useState, useEffect } from "react";
import { HourlyTrendPoint } from "@/types/fleet";
import { Device } from "@/types/device";
import { SkeletonTrendChart } from "@/components/shared/Skeleton";
import { NoDataState } from "@/components/shared/NoDataState";
import { useTheme } from "@/lib/theme/ThemeProvider";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { Activity, Server } from "lucide-react";

interface TrendChartProps {
  hourlyData?: HourlyTrendPoint[] | null;
  loading?: boolean;
  selectedDeviceId?: string;
  deviceList?: Device[];
  onSelectDevice?: (deviceId: string) => void;
  onRetry?: () => void;
}

export function TrendChart({
  hourlyData,
  loading = false,
  selectedDeviceId,
  deviceList = [],
  onSelectDevice,
  onRetry,
}: TrendChartProps) {
  const [mounted, setMounted] = useState(false);
  const { theme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (loading) {
    return <SkeletonTrendChart />;
  }

  if (!hourlyData || hourlyData.length === 0) {
    return <NoDataState message="No data — agent may be offline" onRetry={onRetry} />;
  }

  const avgEmissions = (
    hourlyData.reduce((acc, curr) => acc + curr.carbon_g, 0) / hourlyData.length
  ).toFixed(1);

  const isLight = theme === "light";

  return (
    <section className="eco-card mb-8 p-6">
      {/* Chart Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-accent" />
            <h2 className="font-display text-base font-semibold text-text">
              24-Hour Historical Carbon Telemetry Trend
            </h2>
            <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              Live Stream
            </span>
          </div>
          <p className="text-xs text-text-muted mt-0.5">
            Historical hourly carbon emissions (g CO2e) fetched from <code className="font-mono text-accent">/api/devices/[id]/history</code>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Device Selector */}
          {deviceList.length > 0 && (
            <div className="flex items-center gap-1.5 rounded border border-border bg-bg/80 px-2.5 py-1 text-xs font-mono">
              <Server className="h-3.5 w-3.5 text-accent shrink-0" />
              <select
                value={selectedDeviceId || "all"}
                onChange={(e) => onSelectDevice?.(e.target.value)}
                className="bg-transparent text-text focus:outline-none cursor-pointer"
              >
                <option value="all" className="bg-panel text-text">Fleet Aggregate (All)</option>
                {deviceList.map((d) => (
                  <option key={d.device_id} value={d.device_id} className="bg-panel text-text">
                    {d.device_id}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="hidden md:flex items-center gap-2 border-l border-border pl-3 text-xs font-mono text-text-muted">
            <span>Avg Hourly:</span>
            <span className="font-bold text-success tabular-nums">{avgEmissions} g CO2e</span>
          </div>
        </div>
      </div>

      {/* Recharts LineChart */}
      <div className="h-64 md:h-72 w-full pt-2">
        {mounted ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={hourlyData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={isLight ? "rgba(0,0,0,0.06)" : "rgba(30,42,54,0.8)"}
                vertical={false}
              />
              <XAxis
                dataKey="hour"
                stroke={isLight ? "#475569" : "#64748b"}
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: isLight ? "rgba(0,0,0,0.08)" : "#1e2a36" }}
              />
              <YAxis
                stroke={isLight ? "#475569" : "#64748b"}
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: isLight ? "rgba(0,0,0,0.08)" : "#1e2a36" }}
                unit=" g"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: isLight ? "#ffffff" : "#111720",
                  borderColor: isLight ? "rgba(0,0,0,0.1)" : "#1e2a36",
                  borderRadius: "6px",
                  color: isLight ? "#0f172a" : "#e2e8f0",
                  fontSize: "12px",
                  fontFamily: "monospace",
                  boxShadow: "none",
                }}
                formatter={(value: any) => [`${value ?? 0} g CO2e`, "Emissions"]}
                labelFormatter={(label) => `Time: ${label}`}
              />
              <Line
                type="monotone"
                dataKey="carbon_g"
                stroke="#22C55E"
                strokeWidth={2}
                dot={{ r: 2, fill: "#22C55E", strokeWidth: 0 }}
                activeDot={{ r: 5, fill: "#3b82f6", stroke: isLight ? "#ffffff" : "#111720", strokeWidth: 1 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full w-full flex items-center justify-center font-mono text-xs text-text-muted">
            Loading chart telemetry...
          </div>
        )}
      </div>
    </section>
  );
}
