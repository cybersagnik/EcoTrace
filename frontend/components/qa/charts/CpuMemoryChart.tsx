"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { TelemetryRow } from "@/types/telemetry";
import { QA_COLORS, useChartTheme } from "@/utils/qa/chartTheme";
import { EmptyChartState } from "./EmptyChartState";

export function CpuMemoryChart({ rows }: { rows: TelemetryRow[] }) {
  const theme = useChartTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const data = useMemo(() => {
    const sums = new Map<string, { cpu: number; mem: number; count: number }>();
    rows.forEach((r) => {
      const key = r.deviceId || "unknown";
      const entry = sums.get(key) ?? { cpu: 0, mem: 0, count: 0 };
      entry.cpu += r.cpuUsagePct;
      entry.mem += r.memoryUsagePct;
      entry.count += 1;
      sums.set(key, entry);
    });
    return Array.from(sums.entries())
      .map(([deviceId, e]) => ({
        deviceId,
        cpu: Number((e.cpu / e.count).toFixed(1)),
        mem: Number((e.mem / e.count).toFixed(1)),
      }))
      .sort((a, b) => b.cpu - a.cpu);
  }, [rows]);

  if (data.length === 0) return <EmptyChartState />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} vertical={false} />
        <XAxis
          dataKey="deviceId"
          stroke={theme.axis}
          fontSize={10}
          tickLine={false}
          axisLine={{ stroke: theme.axisLine }}
          interval={0}
          angle={-18}
          height={52}
          textAnchor="end"
        />
        <YAxis
          stroke={theme.axis}
          fontSize={11}
          tickLine={false}
          axisLine={{ stroke: theme.axisLine }}
          domain={[0, 100]}
          unit="%"
        />
        <Tooltip
          cursor={{ fill: "rgba(59,130,246,0.06)" }}
          contentStyle={{
            backgroundColor: theme.tooltipBg,
            borderColor: theme.tooltipBorder,
            borderRadius: "6px",
            color: theme.tooltipText,
            fontSize: "12px",
            fontFamily: "monospace",
            boxShadow: "none",
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: "11px", fontFamily: "monospace", color: theme.axis }}
        />
        {mounted && (
          <>
            <Bar dataKey="cpu" name="Avg CPU %" fill={QA_COLORS.cpu} radius={[3, 3, 0, 0]} maxBarSize={28} />
            <Bar dataKey="mem" name="Avg Memory %" fill={QA_COLORS.mem} radius={[3, 3, 0, 0]} maxBarSize={28} />
          </>
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}
