"use client";

import { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { TelemetryRow } from "@/types/telemetry";
import { QA_COLORS, useChartTheme } from "@/utils/qa/chartTheme";
import { EmptyChartState } from "./EmptyChartState";

export function CarbonByFleetChart({ rows }: { rows: TelemetryRow[] }) {
  const theme = useChartTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const data = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((r) => {
      const fleet = r.fleetName ?? r.fleetId ?? "Unassigned";
      map.set(fleet, (map.get(fleet) ?? 0) + r.carbonG);
    });
    return Array.from(map.entries())
      .map(([fleet, carbonG]) => ({ fleet, carbonG: Number(carbonG.toFixed(1)) }))
      .sort((a, b) => b.carbonG - a.carbonG);
  }, [rows]);

  if (data.length === 0) return <EmptyChartState />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} horizontal={false} />
        <XAxis
          type="number"
          stroke={theme.axis}
          fontSize={11}
          tickLine={false}
          axisLine={{ stroke: theme.axisLine }}
        />
        <YAxis
          type="category"
          dataKey="fleet"
          width={96}
          stroke={theme.axis}
          fontSize={11}
          tickLine={false}
          axisLine={{ stroke: theme.axisLine }}
        />
        <Tooltip
          cursor={{ fill: "rgba(34,197,94,0.06)" }}
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
          <Bar dataKey="carbonG" name="Carbon (g CO2e)" fill={QA_COLORS.carbon} barSize={16} radius={[0, 3, 3, 0]} />
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}
