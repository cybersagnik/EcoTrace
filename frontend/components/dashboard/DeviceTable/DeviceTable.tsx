"use client";

import { useState } from "react";
import { Device } from "@/types/device";
import { formatCarbonG } from "@/utils/formatter";
import { classifyIntensity } from "@/utils/calculations";
import { StatusBadge, ComingSoonBadge } from "@/components/dashboard/DeviceStatus";
import { SkeletonDeviceTable } from "@/components/shared/Skeleton";
import { NoDataState } from "@/components/shared/NoDataState";
import { Search, Cpu, Server, Activity, Flame } from "lucide-react";

interface DeviceTableProps {
  devices?: Device[] | null;
  loading?: boolean;
  onRetry?: () => void;
  onSelectDevice?: (deviceId: string) => void;
  selectedDeviceId?: string;
}

export function DeviceTable({
  devices,
  loading = false,
  onRetry,
  onSelectDevice,
  selectedDeviceId,
}: DeviceTableProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  if (loading) {
    return <SkeletonDeviceTable />;
  }

  if (!devices || devices.length === 0) {
    return <NoDataState message="No data — agent may be offline" onRetry={onRetry} />;
  }

  // Find the single highest-emitting device
  const highestEmitter = devices.reduce(
    (max, d) => (d.carbon_g > (max?.carbon_g ?? -1) ? d : max),
    devices[0]
  );

  const filteredDevices = devices.filter((d) => {
    const matchesSearch =
      d.device_id.toLowerCase().includes(search.toLowerCase()) ||
      d.device_class.toLowerCase().includes(search.toLowerCase()) ||
      (d.os && d.os.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus =
      statusFilter === "all" || d.status.toLowerCase() === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <section className="eco-card mb-8 overflow-hidden">
      {/* Table Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 border-b border-border">
        <div className="flex items-center gap-2">
          <Cpu className="h-3.5 w-3.5 text-accent" />
          <h2 className="font-display text-base font-semibold text-text">
            Active Telemetry Sensors
          </h2>
          <span className="rounded bg-border px-2 py-0.5 font-mono text-xs text-text-muted tabular-nums">
            {filteredDevices.length} nodes online
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-text-faint" />
            <input
              type="text"
              placeholder="Search by device ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-eco w-60 pl-8 pr-3 py-1.5 font-mono text-xs"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center rounded border border-border bg-bg/80 p-1">
            {["all", "operating", "registering", "offline"].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`rounded px-2.5 py-1 text-xs font-medium capitalize transition-colors cursor-pointer ${
                  statusFilter === status
                    ? "bg-elevated text-text font-semibold"
                    : "text-text-muted hover:text-text"
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table View */}
      <div className="overflow-x-auto min-w-full">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-border bg-transparent font-mono text-text-muted uppercase tracking-[0.08em] text-[11px]">
            <tr>
              <th className="px-5 py-3 font-semibold">Device ID</th>
              <th className="px-5 py-3 font-semibold">OS</th>
              <th className="px-5 py-3 font-semibold">Carbon Today</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border font-mono">
            {filteredDevices.map((d) => {
              const isSelected = selectedDeviceId === d.device_id;
              const isHighest = highestEmitter && highestEmitter.device_id === d.device_id;
              const intensityGrade = classifyIntensity(d.carbon_g);

              const carbonColorClass =
                intensityGrade === "clean"
                  ? "text-success font-semibold"
                  : intensityGrade === "moderate"
                  ? "text-moderate"
                  : "text-high font-extrabold";

              return (
                <tr
                  key={d.device_id}
                  onClick={() => onSelectDevice?.(d.device_id)}
                  className={`group transition-colors duration-150 cursor-pointer ${
                    isSelected
                      ? "bg-elevated/50"
                      : "hover:bg-elevated/40"
                  }`}
                >
                  <td className="px-5 py-3.5 font-semibold text-text flex items-center gap-2">
                    {d.status === "registering" ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-moderate shrink-0" />
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-success shrink-0" />
                    )}
                    <span>{d.device_id}</span>
                    {isHighest && (
                      <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold text-high">
                        <Flame className="h-3 w-3" />
                        Highest Emitter
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-text-muted font-sans font-medium">
                    <div className="flex items-center gap-2">
                      <span>{d.os ?? d.device_class.replace("-", " · ")}</span>
                      {(d.device_class === "iot-sensor" || d.device_class === "plc-controller") && (
                        <ComingSoonBadge />
                      )}
                    </div>
                  </td>
                  <td className={`px-5 py-3.5 font-bold tabular-nums ${carbonColorClass}`}>
                    {formatCarbonG(d.carbon_g)}
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={d.status} />
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      aria-label="View history chart"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectDevice?.(d.device_id);
                      }}
                      className="rounded px-2.5 py-1 text-xs text-accent hover:bg-accent/10 transition-colors font-semibold cursor-pointer"
                    >
                      <Activity className="h-3.5 w-3.5 inline mr-1" />
                      History
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
