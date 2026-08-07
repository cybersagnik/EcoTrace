"use client";

import { ClipboardCheck, FileSpreadsheet, Hand, Trash2 } from "lucide-react";
import { QaDashboardProvider, useQaDashboard } from "@/features/qa/QaDashboardProvider";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { CsvImportTab } from "@/components/qa/CsvImportTab";
import { ManualEntryTab } from "@/components/qa/ManualEntryTab";
import { FilterBar } from "@/components/qa/FilterBar";
import { KpiCards } from "@/components/qa/KpiCards";
import { ValidationReport } from "@/components/qa/ValidationReport";
import { TelemetryTable } from "@/components/qa/TelemetryTable";
import { ChartCard } from "@/components/qa/ChartCard";
import { ChartErrorBoundary } from "@/components/qa/ChartErrorBoundary";
import { CarbonByDeviceChart } from "@/components/qa/charts/CarbonByDeviceChart";
import { CarbonByFleetChart } from "@/components/qa/charts/CarbonByFleetChart";
import { CarbonByRegionChart } from "@/components/qa/charts/CarbonByRegionChart";
import { AttributionModelChart } from "@/components/qa/charts/AttributionModelChart";
import { CpuMemoryChart } from "@/components/qa/charts/CpuMemoryChart";
import { EnergyTrendChart } from "@/components/qa/charts/EnergyTrendChart";
import { cn } from "@/utils/helpers";

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-md border px-4 py-2 font-mono text-xs transition-colors cursor-pointer",
        active
          ? "border-accent/40 bg-accent/10 text-accent"
          : "border-border bg-elevated/50 text-text-muted hover:text-text hover:border-accent/40"
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function QaDashboardInner() {
  const { hasDataset, hydrated, activeTab, setActiveTab, clearDataset, sourceInfo, score, filteredRows } =
    useQaDashboard();

  const zoneBadge =
    !hasDataset || score.zone === "green"
      ? "Dataset Ready"
      : score.zone === "amber"
        ? "Needs Review"
        : "Blocking Issues";

  return (
    <div className="space-y-5">
      <PageHeader
        title="Telemetry QA Dashboard"
        subtitle="Import telemetry exports, validate them against the canonical envelope contract (16 checks), then explore carbon, energy and workload analytics on the validated dataset."
        badge={hasDataset ? `${sourceInfo?.rowCount ?? filteredRows.length} rows · ${zoneBadge}` : undefined}
        action={
          hasDataset ? (
            <button
              onClick={clearDataset}
              className="flex items-center gap-2 rounded border border-border bg-elevated px-3 py-2 font-mono text-xs text-text-muted transition-colors hover:border-high/40 hover:text-high cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear dataset
            </button>
          ) : undefined
        }
      />

      {!hasDataset ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <TabButton
              active={activeTab === "csv"}
              onClick={() => setActiveTab("csv")}
              icon={<FileSpreadsheet className="h-3.5 w-3.5" />}
            >
              CSV Import
            </TabButton>
            <TabButton
              active={activeTab === "manual"}
              onClick={() => setActiveTab("manual")}
              icon={<Hand className="h-3.5 w-3.5" />}
            >
              Manual Entry
            </TabButton>
          </div>
          {hydrated && activeTab === "manual" ? <ManualEntryTab /> : <CsvImportTab />}
        </>
      ) : (
        <>
          <FilterBar />
          <KpiCards />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartErrorBoundary label="Energy Trend">
              <ChartCard
                title="Energy Consumption Trend"
                subtitle="Total energy (Wh) per day across the filtered dataset"
                downloadName="ecotrace_qa_energy_trend"
                icon={<ClipboardCheck className="h-3.5 w-3.5 text-accent" />}
              >
                <EnergyTrendChart rows={filteredRows} />
              </ChartCard>
            </ChartErrorBoundary>
            <ChartErrorBoundary label="Carbon by Device">
              <ChartCard
                title="Carbon by Device"
                subtitle="Total CO2e (g) per device ID"
                downloadName="ecotrace_qa_carbon_by_device"
                icon={<ClipboardCheck className="h-3.5 w-3.5 text-accent" />}
              >
                <CarbonByDeviceChart rows={filteredRows} />
              </ChartCard>
            </ChartErrorBoundary>
            <ChartErrorBoundary label="Carbon by Fleet">
              <ChartCard
                title="Carbon by Fleet"
                subtitle="Total CO2e (g) per fleet (unassigned grouped separately)"
                downloadName="ecotrace_qa_carbon_by_fleet"
                icon={<ClipboardCheck className="h-3.5 w-3.5 text-accent" />}
              >
                <CarbonByFleetChart rows={filteredRows} />
              </ChartCard>
            </ChartErrorBoundary>
            <ChartErrorBoundary label="Carbon by Region">
              <ChartCard
                title="Carbon by Grid Region"
                subtitle="Share of CO2e across grid regions"
                downloadName="ecotrace_qa_carbon_by_region"
                icon={<ClipboardCheck className="h-3.5 w-3.5 text-accent" />}
              >
                <CarbonByRegionChart rows={filteredRows} />
              </ChartCard>
            </ChartErrorBoundary>
            <ChartErrorBoundary label="Attribution Model">
              <ChartCard
                title="Carbon by Attribution Model"
                subtitle="Total CO2e per emission-factor model version"
                downloadName="ecotrace_qa_attribution_model"
                icon={<ClipboardCheck className="h-3.5 w-3.5 text-accent" />}
              >
                <AttributionModelChart rows={filteredRows} />
              </ChartCard>
            </ChartErrorBoundary>
            <ChartErrorBoundary label="CPU / Memory">
              <ChartCard
                title="CPU vs Memory by Device"
                subtitle="Average utilisation per device (0–100%)"
                downloadName="ecotrace_qa_cpu_memory"
                icon={<ClipboardCheck className="h-3.5 w-3.5 text-accent" />}
              >
                <CpuMemoryChart rows={filteredRows} />
              </ChartCard>
            </ChartErrorBoundary>
          </div>

          <ValidationReport />
          <TelemetryTable />
        </>
      )}
    </div>
  );
}

export default function QaPage() {
  return (
    <QaDashboardProvider>
      <QaDashboardInner />
    </QaDashboardProvider>
  );
}
