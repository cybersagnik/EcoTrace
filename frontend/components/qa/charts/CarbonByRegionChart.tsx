"use client";

import { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { TelemetryRow } from "@/types/telemetry";
import { QA_PALETTE, useChartTheme } from "@/utils/qa/chartTheme";
import { EmptyChartState } from "./EmptyChartState";

export function CarbonByRegionChart({ rows }: { rows: TelemetryRow[] }) {
  const theme = useChartTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const data = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((r) => {
      const region = r.gridRegion ?? "Unassigned";
      map.set(region, (map.get(region) ?? 0) + r.carbonG);
    });
    return Array.from(map.entries())
      .map(([region, carbonG]) => ({ region, carbonG: Number(carbonG.toFixed(1)) }))
      .sort((a, b) => b.carbonG - a.carbonG);
  }, [rows]);

  if (data.length === 0) return <EmptyChartState />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
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
          <Pie
            data={data}
            dataKey="carbonG"
            nameKey="region"
            cx="50%"
            cy="50%"
            innerRadius={48}
            outerRadius={80}
            paddingAngle={2}
            stroke={theme.isLight ? "#ffffff" : "#0A0E13"}
          >
            {data.map((entry, idx) => (
              <Cell key={entry.region} fill={QA_PALETTE[idx % QA_PALETTE.length]} />
            ))}
          </Pie>
        )}
      </PieChart>
    </ResponsiveContainer>
  );
}
