"use client";

import { useState, useEffect, useCallback } from "react";
import { useDevices } from "@/hooks/useDevices";
import { useFleet } from "@/hooks/useFleet";
import { useRecommendation } from "@/hooks/useRecommendation";
import { getDeviceHistory } from "@/services/api/devices";
import { HourlyTrendPoint } from "@/types/fleet";
import { FleetCard } from "@/components/dashboard/FleetCard";
import { DeviceTable } from "@/components/dashboard/DeviceTable";
import { TrendChart } from "@/components/dashboard/TrendChart";
import { RecoCard } from "@/components/dashboard/RecoCard";
import { LiveActivityStream } from "@/components/dashboard/LiveActivityStream";
import { PageHeader } from "@/components/shared/PageHeader";
import { downloadPDFReport } from "@/utils/export";
import { RefreshCw, Download } from "lucide-react";

export default function DashboardPage() {
  const { devices, loading: devicesLoading, error: devicesError, refetch: refetchDevices } = useDevices();
  const { fleet, loading: fleetLoading, error: fleetError, refetch: refetchFleet } = useFleet();
  const { data: recoData, loading: recoLoading, refetch: refetchReco } = useRecommendation();

  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("all");
  const [deviceHistory, setDeviceHistory] = useState<HourlyTrendPoint[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const fetchHistory = useCallback(async (deviceId: string) => {
    if (deviceId === "all") {
      setDeviceHistory(null);
      return;
    }
    setHistoryLoading(true);
    try {
      const res = await getDeviceHistory(deviceId);
      setDeviceHistory(res.history);
    } catch {
      setDeviceHistory(null);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedDeviceId && selectedDeviceId !== "all") {
      fetchHistory(selectedDeviceId);
    } else {
      setDeviceHistory(null);
    }
  }, [selectedDeviceId, fetchHistory]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refetchDevices(),
        refetchFleet(),
        refetchReco(),
        selectedDeviceId !== "all" ? fetchHistory(selectedDeviceId) : Promise.resolve(),
      ]);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const handleExportSummary = () => {
    downloadPDFReport("Executive Summary - Fleet Sustainability Overview");
  };

  const activeHourlyData =
    selectedDeviceId !== "all" && deviceHistory
      ? deviceHistory
      : fleet?.hourly_trend ?? null;

  return (
    <div className="space-y-6 md:space-y-8 animate-fade-in">
      <PageHeader
        title="Fleet Sustainability Overview"
        subtitle="Real-time IoT telemetry, carbon footprint tracking & grid intensity metrics."
        badge="Phase 4 — Demo Frozen & Verified"
        action={
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 rounded-xl border border-border bg-elevated/70 px-3.5 py-2 font-mono text-xs font-medium text-text hover:border-accent/40 hover:text-accent transition-all active:scale-95 cursor-pointer shadow-level-1 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-text-muted ${isRefreshing ? "animate-spin text-accent" : ""}`} />
              <span>{isRefreshing ? "Refreshing..." : "Refresh Telemetry (30s Polling)"}</span>
            </button>
            <button
              onClick={handleExportSummary}
              className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2 font-mono text-xs font-semibold text-bg hover:bg-sky-400 transition-all shadow-glow active:scale-95 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export Executive Summary</span>
            </button>
          </div>
        }
      />

      <FleetCard
        summary={fleetSummaryOrError(fleet, fleetError)}
        loading={fleetLoading}
        onRetry={refetchFleet}
      />

      <RecoCard
        recommendations={recoData?.recommendations}
        totalSavingsKg={recoData?.total_potential_savings_kg}
        loading={recoLoading}
      />

      <TrendChart
        hourlyData={activeHourlyData}
        loading={fleetLoading || historyLoading}
        selectedDeviceId={selectedDeviceId}
        deviceList={devices ?? []}
        onSelectDevice={(id) => setSelectedDeviceId(id)}
        onRetry={handleRefresh}
      />

      <DeviceTable
        devices={devicesOrError(devices, devicesError)}
        loading={devicesLoading}
        onRetry={refetchDevices}
        selectedDeviceId={selectedDeviceId}
        onSelectDevice={(id) => setSelectedDeviceId(id)}
      />

      <LiveActivityStream />
    </div>
  );
}

function fleetSummaryOrError(fleet: any, error: any) {
  if (error || !fleet) return null;
  return fleet.summary;
}

function devicesOrError(devices: any, error: any) {
  if (error || !devices) return null;
  return devices;
}
