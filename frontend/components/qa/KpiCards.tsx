"use client";

import { useQaDashboard } from "@/features/qa/QaDashboardProvider";
import { Card } from "@/components/ui/Card";
import { formatCarbonGrams, formatEnergyWh, formatNumber, formatPct } from "@/utils/qa/formatters";
import { cn } from "@/utils/helpers";
import { Database, Leaf, Zap, Cpu, MemoryStick, Gauge } from "lucide-react";

interface KpiProps {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  accentClass?: string;
}

function Kpi({ label, value, sub, icon, accentClass = "text-accent" }: KpiProps) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-text-faint">
          {label}
        </span>
        <span className={cn("flex h-7 w-7 items-center justify-center rounded border border-border bg-elevated", accentClass)}>
          {icon}
        </span>
      </div>
      <div className="mt-2 font-mono text-xl font-semibold tabular-nums text-text">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-text-muted">{sub}</div>}
    </Card>
  );
}

const ZONE_STYLES: Record<string, string> = {
  green: "text-success border-success/30",
  amber: "text-moderate border-moderate/30",
  red: "text-high border-high/30",
};

export function KpiCards() {
  const { filteredRows, score, rows, filters } = useQaDashboard();

  const totalCarbonG = filteredRows.reduce((acc, r) => acc + r.carbonG, 0);
  const totalEnergyWh = filteredRows.reduce((acc, r) => acc + r.energyWh, 0);
  const avgCpu =
    filteredRows.length > 0
      ? filteredRows.reduce((acc, r) => acc + r.cpuUsagePct, 0) / filteredRows.length
      : 0;
  const avgMem =
    filteredRows.length > 0
      ? filteredRows.reduce((acc, r) => acc + r.memoryUsagePct, 0) / filteredRows.length
      : 0;

  const filteredCount = filteredRows.length;
  const isFiltered = filteredCount !== rows.length;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <Kpi
        label="Records"
        value={formatNumber(filteredCount)}
        sub={isFiltered ? `of ${formatNumber(rows.length)} total` : "in current view"}
        icon={<Database className="h-3.5 w-3.5" />}
      />
      <Kpi
        label="Carbon"
        value={formatCarbonGrams(totalCarbonG)}
        sub="sum of filtered rows"
        icon={<Leaf className="h-3.5 w-3.5" />}
        accentClass="text-success"
      />
      <Kpi
        label="Energy"
        value={formatEnergyWh(totalEnergyWh)}
        sub="sum of filtered rows"
        icon={<Zap className="h-3.5 w-3.5" />}
        accentClass="text-moderate"
      />
      <Kpi
        label="Avg CPU"
        value={formatPct(avgCpu)}
        sub="filtered rows"
        icon={<Cpu className="h-3.5 w-3.5" />}
        accentClass="text-info"
      />
      <Kpi
        label="Avg Memory"
        value={formatPct(avgMem)}
        sub="filtered rows"
        icon={<MemoryStick className="h-3.5 w-3.5" />}
        accentClass="text-info"
      />
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-text-faint">
            Quality
          </span>
          <span
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded border border-border bg-elevated",
              ZONE_STYLES[score.zone]
            )}
          >
            <Gauge className="h-3.5 w-3.5" />
          </span>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className={cn("font-mono text-xl font-semibold tabular-nums", ZONE_STYLES[score.zone].split(" ")[0])}>
            {score.score}
          </span>
          <span className="text-xs uppercase tracking-wider text-text-faint">/ 100</span>
        </div>
        <div className="mt-0.5 text-xs text-text-muted">
          {score.errors} err · {score.warnings} warn
        </div>
      </Card>
    </div>
  );
}
