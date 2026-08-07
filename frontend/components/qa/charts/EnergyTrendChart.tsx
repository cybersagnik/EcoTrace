"use client";

import { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { TelemetryRow } from "@/types/telemetry";
import { QA_COLORS, useChartTheme } from "@/utils/qa/chartTheme";
import { EmptyChartState } from "./EmptyChartState";

export function EnergyTrendChart({ rows }: { rows: TelemetryRow[] }) {
  const theme = useChartTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const data = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((r) => {
      const d = new Date(r.timestamp);
      const key = Number.isNaN(d.getTime()) ? r.timestamp : d.toISOString().slice(0, 10);
      map.set(key, (map.get(key) ?? 0) + r.energyWh);
    });
    return Array.from(map.entries())
      .map(([day, energyWh]) => ({
        day,
        energyWh: Number(energyWh.toFixed(0)),
        label: Number.isNaN(Date.parse(day)) ? day : new Date(`${day}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      }))
      .sort((a, b) => a.day.localeCompare(b.day));
  }, [rows]);

  if (data.length === 0) return <EmptyChartState />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="qaEnergyFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={QA_COLORS.energy} stopOpacity={0.35} />
            <stop offset="100%" stopColor={QA_COLORS.energy} stopOpacity={0.04} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} vertical={false} />
        <XAxis
          dataKey="label"
          stroke={theme.axis}
          fontSize={11}
          tickLine={false}
          axisLine={{ stroke: theme.axisLine }}
        />
        <YAxis
          stroke={theme.axis}
          fontSize={11}
          tickLine={false}
          axisLine={{ stroke: theme.axisLine }}
          unit=" Wh"
        />
        <Tooltip
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
        {mounted && (
          <Area
            type="monotone"
            dataKey="energyWh"
            name="Energy (Wh)"
            stroke={QA_COLORS.energy}
            strokeWidth={2}
            fill="url(#qaEnergyFill)"
            dot={{ r: 3, fill: QA_COLORS.energy, strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
}
