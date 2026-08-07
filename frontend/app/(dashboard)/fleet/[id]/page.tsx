"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { useFleetDetail } from "@/hooks/useFleetDetail";
import { useDevices } from "@/hooks/useDevices";
import { formatCarbonG } from "@/utils/formatter";
import { DeviceCategory } from "@/types/device";
import {
  ArrowLeft,
  Server,
  Globe,
  Zap,
  Plus,
  X,
  Check,
  Trash2,
  ShieldCheck,
  Cpu,
} from "lucide-react";

export default function FleetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const fleetId = typeof params.id === "string" ? parseInt(params.id, 10) : null;

  const { fleet, loading, error, refetch, assign, unassign } = useFleetDetail(fleetId);
  const { devices: allDevices } = useDevices({ category: "endpoint", pollingIntervalMs: 60000 });
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  if (loading || !fleet) {
    return <LoadingState label="Loading fleet detail..." />;
  }
  if (error) {
    return <ErrorState message={error} onRetry={refetch} />;
  }

  const assignedIds = new Set(fleet.devices.map((d) => d.device_id));
  const unassignedDevices = (allDevices ?? []).filter((d) => !assignedIds.has(d.device_id));

  const handleAssign = async (deviceId: string) => {
    try {
      await assign(deviceId);
      showToast(`Assigned ${deviceId} to ${fleet.name}`);
    } catch (err) {
      showToast(`Failed: ${(err as Error).message}`);
    }
  };

  const handleUnassign = async (deviceId: string) => {
    try {
      await unassign(deviceId);
      showToast(`Unassigned ${deviceId}`);
    } catch (err) {
      showToast(`Failed: ${(err as Error).message}`);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in relative">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded border border-accent/30 bg-panel p-4 text-accent font-mono text-xs">
          <ShieldCheck className="h-4 w-4 shrink-0 text-accent" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Assign modal */}
      {isAssignOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 p-4 animate-fade-in">
          <div className="w-[92vw] max-w-2xl max-h-[85vh] overflow-y-auto rounded border border-border bg-panel p-6 space-y-5 animate-scale-in">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-accent" />
                <h3 className="font-display text-base font-bold text-text">
                  Assign Devices to {fleet.name}
                </h3>
              </div>
              <button
                onClick={() => setIsAssignOpen(false)}
                className="text-text-faint hover:text-text p-1 rounded cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {unassignedDevices.length === 0 ? (
              <div className="rounded bg-elevated/60 border border-border p-6 text-center">
                <Cpu className="h-8 w-8 text-text-faint mx-auto mb-2" />
                <p className="text-sm text-text-muted">
                  No unassigned endpoint devices available.
                </p>
                <p className="text-[11px] text-text-faint mt-1">
                  Provision more devices from <Link href="/devices/endpoints" className="text-accent hover:underline">Devices → Endpoints</Link>.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {unassignedDevices.map((d) => (
                  <div
                    key={d.device_id}
                    className="flex items-center justify-between rounded border border-border bg-bg/60 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="font-mono text-sm font-bold text-text truncate">
                        {d.device_id}
                      </div>
                      <div className="text-[11px] text-text-muted font-mono">
                        {d.hostname ?? "—"} · {d.device_class} · {formatCarbonG(d.carbon_g)}
                      </div>
                    </div>
                    <button
                      onClick={() => handleAssign(d.device_id)}
                      className="flex items-center gap-1.5 rounded bg-accent px-3 py-1.5 font-mono text-xs font-semibold text-bg hover:bg-accent-hover transition-colors cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Assign</span>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-3 border-t border-border">
              <button
                onClick={() => setIsAssignOpen(false)}
                className="rounded border border-border px-4 py-2 font-mono text-xs font-semibold text-text-muted hover:text-text cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => router.push("/fleet")}
        className="flex items-center gap-2 text-xs text-text-muted hover:text-accent transition-colors font-mono cursor-pointer"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>Back to Fleets</span>
      </button>

      <PageHeader
        title={fleet.name}
        subtitle={fleet.description ?? `Fleet ID #${fleet.id} · ${fleet.grid_region}`}
        badge={`${fleet.devices.length} device${fleet.devices.length === 1 ? "" : "s"}`}
        action={
          <button
            onClick={() => setIsAssignOpen(true)}
            className="flex items-center gap-2 rounded bg-accent px-4 py-2.5 font-mono text-xs font-semibold text-white hover:bg-accent-hover transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Assign Devices</span>
          </button>
        }
      />

      {/* Fleet metadata */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-card border border-border bg-panel p-5">
          <div className="flex items-center justify-between text-text-muted mb-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-text-faint">
              Grid Region
            </span>
            <Globe className="h-4 w-4 text-accent" />
          </div>
          <div className="font-mono text-xl font-bold text-text">{fleet.grid_region}</div>
        </div>
        <div className="rounded-card border border-border bg-panel p-5">
          <div className="flex items-center justify-between text-text-muted mb-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-text-faint">
              Grid Intensity
            </span>
            <Zap className="h-4 w-4 text-amber" />
          </div>
          <div className="font-mono text-xl font-bold text-text">
            {fleet.grid_intensity_g_per_kwh.toFixed(0)} <span className="text-sm text-text-faint">gCO2e/kWh</span>
          </div>
        </div>
        <div className="rounded-card border border-border bg-panel p-5">
          <div className="flex items-center justify-between text-text-muted mb-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-text-faint">
              Assigned Devices
            </span>
            <Server className="h-4 w-4 text-success" />
          </div>
          <div className="font-mono text-xl font-bold text-text">{fleet.devices.length}</div>
        </div>
        <div className="rounded-card border border-border bg-panel p-5">
          <div className="flex items-center justify-between text-text-muted mb-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-text-faint">
              Created
            </span>
            <Check className="h-4 w-4 text-blue" />
          </div>
          <div className="font-mono text-sm font-bold text-text">
            {fleet.created_at ? new Date(fleet.created_at).toLocaleDateString() : "—"}
          </div>
        </div>
      </div>

      {/* Devices in fleet */}
      <div className="space-y-3">
        <h2 className="font-display text-lg font-bold text-text">
          Devices in this Fleet
        </h2>

        {fleet.devices.length === 0 ? (
          <div className="rounded border-2 border-dashed border-border bg-panel p-8 text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded bg-elevated text-text-faint">
              <Server className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-text">No devices assigned yet</p>
              <p className="text-xs text-text-muted">
                Click &quot;Assign Devices&quot; to add endpoint devices to this fleet.
              </p>
            </div>
            <button
              onClick={() => setIsAssignOpen(true)}
              className="inline-flex items-center gap-2 rounded bg-accent px-4 py-2 font-mono text-xs font-semibold text-bg hover:bg-accent-hover transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Assign Devices</span>
            </button>
          </div>
        ) : (
          <div className="rounded border border-border bg-panel overflow-hidden">
            <table className="w-full text-left text-xs font-mono">
              <thead className="border-b border-border bg-elevated/40 text-text-faint uppercase">
                <tr>
                  <th className="px-5 py-3.5">Device ID</th>
                  <th className="px-5 py-3.5">Class</th>
                  <th className="px-5 py-3.5">Hostname</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Carbon Today</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {fleet.devices.map((d) => (
                  <tr key={d.device_id} className="hover:bg-elevated/50">
                    <td className="px-5 py-3.5 font-bold text-text">{d.device_id}</td>
                    <td className="px-5 py-3.5 text-text-muted">{d.device_class}</td>
                    <td className="px-5 py-3.5 text-text-muted">{d.hostname ?? "—"}</td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold ${
                          d.status === "operating"
                            ? "bg-accent/10 text-accent border border-accent/30"
                            : "bg-amber/10 text-amber border border-amber/30"
                        }`}
                      >
                        {d.status === "operating" ? "● Live" : d.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-bold text-text">{formatCarbonG(d.carbon_g)}</td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => handleUnassign(d.device_id)}
                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-high hover:bg-high/10 hover:text-high transition-colors cursor-pointer font-semibold"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Unassign</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
