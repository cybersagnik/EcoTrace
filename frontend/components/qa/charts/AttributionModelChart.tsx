"use client";

import { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from "recharts";
import { TelemetryRow } from "@/types/telemetry";
import { QA_PALETTE, useChartTheme } from "@/utils/qa/chartTheme";
import { EmptyChartState } from "./EmptyChartState";

export function AttributionModelChart({ rows }: { rows: TelemetryRow[] }) {
  const theme = useChartTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const data = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((r) => {
      const model = r.attributionModel || "unknown";
      map.set(model, (map.get(model) ?? 0) + r.carbonG);
    });
    return Array.from(map.entries())
      .map(([model, carbonG]) => ({ model, carbonG: Number(carbonG.toFixed(1)) }))
      .sort((a, b) => a.model.localeCompare(b.model));
  }, [rows]);

  if (data.length === 0) return <EmptyChartState />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} vertical={false} />
        <XAxis
          dataKey="model"
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
          <Bar dataKey="carbonG" name="Carbon (g CO2e)" barSize={48} radius={[3, 3, 0, 0]}>
            {data.map((entry, idx) => (
              <Cell key={entry.model} fill={QA_PALETTE[idx % QA_PALETTE.length]} />
            ))}
          </Bar>
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}
