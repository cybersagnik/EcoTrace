"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { useDevices } from "@/hooks/useDevices";
import { LoadingState } from "@/components/shared/LoadingState";
import { StatusBadge, IntensityBadge, ComingSoonBadge } from "@/components/dashboard/DeviceStatus";
import { classifyIntensity } from "@/utils/calculations";
import { formatCarbonG } from "@/utils/formatter";
import { Device, DeviceClass } from "@/types/device";
import { sendOptimizeNotification } from "@/services/api/notifications";
import { RoadmapModal } from "@/components/dashboard/RoadmapModal/RoadmapModal";
import {
  Cpu,
  Plus,
  Grid,
  List,
  Search,
  Server,
  CheckCircle2,
  AlertTriangle,
  Radio,
  X,
  ShieldCheck,
  Trash2,
  Loader2,
  Clock,
  Globe,
  BellRing,
} from "lucide-react";

export default function EndpointsPage() {
  const { devices: initialDevices, loading, refetch } = useDevices({ category: "endpoint" });
  const [deviceList, setDeviceList] = useState<Device[]>([]);
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClass, setSelectedClass] = useState("all");

  // Provision Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newDeviceId, setNewDeviceId] = useState("");
  const [newDeviceClass, setNewDeviceClass] = useState<DeviceClass>("linux-server");
  const [newOS, setNewOS] = useState("Ubuntu 22.04 LTS");

  // Delete Modal State
  const [deletingDevice, setDeletingDevice] = useState<Device | null>(null);
  const [isDeleteLoading, setIsDeleteLoading] = useState(false);

  // Future Roadmap Modal State
  const [roadmapDeviceClass, setRoadmapDeviceClass] = useState<string | null>(null);

  // Optimize Notification State
  const [sendingDevice, setSendingDevice] = useState<string | null>(null);

  // Toast State
  const [toastMsg, setToastMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Sends an optimize-style notification to the device agent over the
  // control plane. Only consenting devices (notification_consent) show the
  // button. HTTP 409 means one was already sent today (dedupe).
  const handleSendOptimizeNotification = async (d: Device) => {
    setSendingDevice(d.device_id);
    try {
      const message = `${d.device_id} emitted ${formatCarbonG(d.carbon_g)} CO₂e today. Close idle background processes to cut power draw.`;
      await sendOptimizeNotification(d.device_id, message);
      showToast(`Optimize notification sent to ${d.device_id}`, "success");
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status === 409) {
        showToast(`Optimize notification already sent to ${d.device_id} today.`, "error");
      } else {
        showToast(`Failed to send optimize notification to ${d.device_id}.`, "error");
      }
    } finally {
      setSendingDevice(null);
    }
  };

  useEffect(() => {
    if (initialDevices) {
      setDeviceList((prev) => {
        const initialMap = new Map(initialDevices.map((d) => [d.device_id, d]));
        const customLocalDevices = prev.filter((d) => !initialMap.has(d.device_id));
        return [...customLocalDevices, ...initialDevices];
      });
    }
  }, [initialDevices]);

  if (loading || !initialDevices) {
    return <LoadingState label="Loading device inventory..." />;
  }

  const handleProvisionDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeviceId.trim()) return;

    const createdDevice: Device = {
      device_id: newDeviceId.trim(),
      device_class: newDeviceClass,
      device_category: "endpoint",
      os: newOS,
      carbon_g: 120.0,
      status: "registering",
      schema_version: "1.0.0",
    };

    // Optimistically update local state so device renders instantly
    setDeviceList((prev) => [
      createdDevice,
      ...prev.filter((d) => d.device_id !== createdDevice.device_id),
    ]);
    setIsModalOpen(false);
    setNewDeviceId("");
    showToast(`Device ${createdDevice.device_id} successfully provisioned!`);

    // Persist to backend API
    try {
      await fetch("/api/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createdDevice),
      });
      refetch();
    } catch {
      // Ignore network errors in offline test environments
    }
  };

  const confirmDeleteDevice = async () => {
    if (!deletingDevice) return;

    const targetId = deletingDevice.device_id;
    setIsDeleteLoading(true);

    try {
      const res = await fetch(`/api/devices?device_id=${encodeURIComponent(targetId)}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to delete device from server.");
      }

      setDeviceList((prev) => prev.filter((d) => d.device_id !== targetId));
      setDeletingDevice(null);
      showToast(`Device ${targetId} successfully deleted!`, "success");
      refetch();
    } catch {
      setDeviceList((prev) => prev.filter((d) => d.device_id !== targetId));
      setDeletingDevice(null);
      showToast(`Device ${targetId} removed from local fleet.`, "success");
      refetch();
    } finally {
      setIsDeleteLoading(false);
    }
  };

  const filteredDevices = deviceList.filter((d) => {
    const matchesSearch = d.device_id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesClass = selectedClass === "all" || d.device_class === selectedClass;
    return matchesSearch && matchesClass;
  });

  const operatingCount = deviceList.filter((d) => d.status === "operating").length;
  const registeringCount = deviceList.filter((d) => d.status === "registering").length;

  return (
    <div className="space-y-8 animate-fade-in relative">
      {/* Toast Notification Banner */}
      {toastMsg && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded border p-4 font-mono text-xs ${
            toastMsg.type === "success"
              ? "border-accent/30 bg-panel text-success"
              : "border-high/30 bg-panel text-high"
          }`}
        >
          {toastMsg.type === "success" ? (
            <ShieldCheck className="h-4 w-4 shrink-0 text-success" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0 text-high" />
          )}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Delete Confirmation Modal Dialog */}
      {deletingDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 p-4 animate-fade-in">
          <div className="w-[92vw] max-w-md max-h-[85vh] overflow-y-auto rounded border border-high/40 bg-panel p-5 sm:p-6 space-y-5 animate-scale-in">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2 text-high">
                <Trash2 className="h-5 w-5" />
                <h3 className="font-display text-base font-bold text-text">Delete Device</h3>
              </div>
              <button
                onClick={() => setDeletingDevice(null)}
                className="text-text-faint hover:text-text p-1 rounded cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <p className="text-text font-semibold">
                Are you sure you want to delete this device?
              </p>
              <p className="text-text-muted leading-relaxed">
                Device ID: <span className="font-bold text-accent">{deletingDevice.device_id}</span>
              </p>
              <div className="rounded bg-high/10 border border-high/20 p-3 text-high font-semibold">
                This action cannot be undone.
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-border font-mono text-xs">
              <button
                type="button"
                disabled={isDeleteLoading}
                onClick={() => setDeletingDevice(null)}
                className="rounded border border-border px-4 py-2 font-semibold text-text-muted hover:text-text transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleteLoading}
                onClick={confirmDeleteDevice}
                className="flex items-center gap-2 rounded bg-high px-4 py-2 font-semibold text-white hover:bg-high transition-colors cursor-pointer disabled:opacity-50"
              >
                {isDeleteLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Provisioning Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 p-4 animate-fade-in">
          <div className="w-[92vw] max-w-md max-h-[85vh] overflow-y-auto rounded border border-border bg-panel p-5 sm:p-6 space-y-5 animate-scale-in">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Cpu className="h-5 w-5 text-accent" />
                <h3 className="font-display text-base font-bold text-text">Provision New Node</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-text-faint hover:text-text p-1 rounded cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleProvisionDevice} className="space-y-4 font-mono text-xs">
              <div>
                <label className="block text-text-muted mb-1.5 font-semibold">Device Hostname / ID</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. edge-node-linux-05"
                  value={newDeviceId}
                  onChange={(e) => setNewDeviceId(e.target.value)}
                  className="w-full rounded border border-border bg-elevated/40 px-3 py-2 text-text placeholder-text-faint focus:border-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-text-muted mb-1.5 font-semibold">Hardware Class</label>
                <select
                  value={newDeviceClass}
                  onChange={(e) => setNewDeviceClass(e.target.value as DeviceClass)}
                  className="w-full rounded border border-border bg-elevated/40 px-3 py-2 text-text focus:border-accent focus:outline-none cursor-pointer"
                >
                  <option value="linux-server" className="bg-panel text-text">Linux Server</option>
                  <option value="windows-workstation" className="bg-panel text-text">Windows Workstation</option>
                  <option value="iot-sensor" className="bg-panel text-text">IoT Sensor (Coming Soon)</option>
                  <option value="plc-controller" className="bg-panel text-text">PLC Controller (Coming Soon)</option>
                </select>
              </div>

              {(newDeviceClass === "iot-sensor" || newDeviceClass === "plc-controller") && (
                <div className="rounded border border-amber/35 bg-amber/10 p-3 text-[11px] text-amber flex items-start gap-2.5 leading-relaxed">
                  <Clock className="h-4 w-4 text-amber shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-amber block mb-0.5">Phase 5 Future Goal Roadmap Notice:</span>
                    Telemetry protocol drivers for {newDeviceClass === "plc-controller" ? "Industrial PLCs (Modbus/OPC-UA)" : "IoT Edge Sensors (MQTT/CoAP)"} are in active R&D. Submitting will pre-register this node for automatic early access activation when Driver Engine v2.0 releases.
                  </div>
                </div>
              )}

              <div>
                <label className="block text-text-muted mb-1.5 font-semibold">Operating System</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ubuntu 22.04 LTS"
                  value={newOS}
                  onChange={(e) => setNewOS(e.target.value)}
                  className="w-full rounded border border-border bg-elevated/40 px-3 py-2 text-text placeholder-text-faint focus:border-accent focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded border border-border px-4 py-2 font-semibold text-text-muted hover:text-text cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded bg-accent px-4 py-2 font-semibold text-bg hover:bg-accent-hover transition-colors cursor-pointer"
                >
                  Register Device
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <PageHeader
        title="Endpoint Devices"
        subtitle="Tier 1 telemetry agents — Linux servers and Windows workstations running the EcoTrace Agent Core."
        badge={`${deviceList.length} Total Registered`}
        action={
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn-primary flex items-center gap-2 rounded bg-accent px-4 py-2.5 font-mono text-xs font-semibold text-white hover:bg-accent-hover transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Provision New Device</span>
          </button>
        }
      />

      {/* Device Overview Stats Banner */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="eco-card rounded border border-border bg-panel p-5 flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded bg-accent/10 text-accent">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <div className="font-mono text-xl font-bold text-text">{operatingCount} / {deviceList.length}</div>
            <div className="text-xs text-text-muted">Operating & Reporting</div>
          </div>
        </div>

        <div className="eco-card rounded border border-border bg-panel p-5 flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded bg-amber/10 text-amber">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <div className="font-mono text-xl font-bold text-amber">{registeringCount}</div>
            <div className="text-xs text-text-muted">Registering Nodes</div>
          </div>
        </div>

        <div className="eco-card rounded border border-border bg-panel p-5 flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded bg-blue/10 text-blue">
            <Radio className="h-5 w-5" />
          </div>
          <div>
            <div className="font-mono text-xl font-bold text-text">99.8%</div>
            <div className="text-xs text-text-muted">Telemetry Uptime</div>
          </div>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded border border-border bg-panel p-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-text-faint" />
            <input
              type="text"
              placeholder="Search by device ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64 rounded border border-border bg-bg/70 pl-8 pr-3 py-1.5 font-mono text-xs text-text placeholder-text-faint focus:border-accent focus:outline-none transition-colors"
            />
          </div>

          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="rounded border border-border bg-bg/70 px-3 py-1.5 font-mono text-xs text-text focus:border-accent focus:outline-none cursor-pointer"
          >
            <option value="all" className="bg-panel text-text">All Device Classes</option>
            <option value="linux-server" className="bg-panel text-text">Linux Server</option>
            <option value="windows-workstation" className="bg-panel text-text">Windows Workstation</option>
            <option value="iot-sensor" className="bg-panel text-text">IoT Sensor (Coming Soon)</option>
            <option value="plc-controller" className="bg-panel text-text">PLC Controller (Coming Soon)</option>
          </select>
        </div>

        {/* View Switcher */}
        <div className="flex items-center rounded border border-border bg-bg/80 p-1">
          <button
            onClick={() => setViewMode("grid")}
            className={`rounded p-1.5 transition-colors cursor-pointer ${
              viewMode === "grid" ? "bg-accent text-bg" : "text-text-muted hover:text-text"
            }`}
          >
            <Grid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={`rounded p-1.5 transition-colors cursor-pointer ${
              viewMode === "table" ? "bg-accent text-bg" : "text-text-muted hover:text-text"
            }`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Grid or Table Layout */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredDevices.map((d) => {
            const intensity = classifyIntensity(d.carbon_g);
            return (
              <div
                key={d.device_id}
                className="group relative flex flex-col justify-between rounded-card border border-border bg-panel p-5 transition-colors hover:border-accent/50"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Server className="h-4 w-4 text-accent shrink-0" />
                      <span className="font-mono text-sm font-bold text-text truncate">{d.device_id}</span>
                    </div>
                    <StatusBadge status={d.status} />
                  </div>

                  <div className="mb-4 flex items-center justify-between gap-2 text-xs font-mono">
                    <span className="text-text-faint uppercase tracking-wider truncate">
                      {d.os ?? d.device_class.replace("-", " ")}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {d.fleet_name ? (
                        <span
                          className="inline-flex items-center gap-1 rounded border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent"
                          title={`Fleet: ${d.fleet_name} (${d.fleet_region ?? "—"})`}
                        >
                          <Globe className="h-3 w-3" />
                          <span className="truncate max-w-[80px]">{d.fleet_name}</span>
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 rounded border border-border bg-elevated px-2 py-0.5 text-[10px] font-semibold text-text-faint"
                          title="Not assigned to any fleet"
                        >
                          <Globe className="h-3 w-3" />
                          <span>Unassigned</span>
                        </span>
                      )}
                      {(d.device_class === "iot-sensor" || d.device_class === "plc-controller") && (
                        <ComingSoonBadge />
                      )}
                    </div>
                  </div>

                  <div className="rounded bg-bg/60 p-3 mb-4 space-y-2 font-mono text-xs">
                    <div className="flex justify-between">
                      <span className="text-text-faint">Carbon Output:</span>
                      <span className="font-bold text-text">{formatCarbonG(d.carbon_g)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-faint">Intensity Grade:</span>
                      <IntensityBadge level={intensity} />
                    </div>
                  </div>

                  {d.notification_consent && (
                    <button
                      onClick={() => handleSendOptimizeNotification(d)}
                      disabled={sendingDevice === d.device_id}
                      className="mb-4 flex w-full items-center justify-center gap-2 rounded border border-accent/30 bg-accent/10 px-3 py-2 font-mono text-xs font-semibold text-accent transition-colors hover:bg-accent/20 cursor-pointer disabled:opacity-50"
                      title="Sends an optimize notification to this workstation's agent"
                    >
                      {sendingDevice === d.device_id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <BellRing className="h-3.5 w-3.5" />
                      )}
                      {sendingDevice === d.device_id ? "Sending..." : "Send Optimize Notification"}
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-border pt-3 text-[11px] font-mono text-text-faint">
                  {(d.device_class === "iot-sensor" || d.device_class === "plc-controller") ? (
                    <button
                      onClick={() => setRoadmapDeviceClass(d.device_class)}
                      className="text-amber font-bold hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <Clock className="h-3 w-3" />
                      <span>Roadmap Specs →</span>
                    </button>
                  ) : (
                    <span className="text-accent group-hover:underline cursor-pointer">Configure →</span>
                  )}
                  <button
                    onClick={() => setDeletingDevice(d)}
                    className="flex items-center gap-1 rounded px-2 py-1 text-high hover:bg-high/10 hover:text-high transition-colors cursor-pointer"
                    title="Delete Device"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded border border-border bg-panel overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="border-b border-border bg-elevated/40 text-text-faint uppercase">
              <tr>
                <th className="px-5 py-3.5">Device ID</th>
                <th className="px-5 py-3.5">OS / Class</th>
                <th className="px-5 py-3.5">Carbon Output</th>
                <th className="px-5 py-3.5">Intensity</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredDevices.map((d) => (
                <tr key={d.device_id} className="hover:bg-elevated/50">
                  <td className="px-5 py-3.5 font-bold text-text">{d.device_id}</td>
                  <td className="px-5 py-3.5 text-text-muted">
                    <div className="flex items-center gap-2">
                      <span>{d.os ?? d.device_class}</span>
                      {d.fleet_name ? (
                        <span
                          className="inline-flex items-center gap-1 rounded border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent"
                          title={`Fleet: ${d.fleet_name} (${d.fleet_region ?? "—"})`}
                        >
                          <Globe className="h-3 w-3" />
                          <span className="truncate max-w-[80px]">{d.fleet_name}</span>
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 rounded border border-border bg-elevated px-2 py-0.5 text-[10px] font-semibold text-text-faint"
                          title="Not assigned to any fleet"
                        >
                          <Globe className="h-3 w-3" />
                          <span>Unassigned</span>
                        </span>
                      )}
                      {(d.device_class === "iot-sensor" || d.device_class === "plc-controller") && (
                        <ComingSoonBadge />
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 font-bold text-text">{formatCarbonG(d.carbon_g)}</td>
                  <td className="px-5 py-3.5">
                    <IntensityBadge level={classifyIntensity(d.carbon_g)} />
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={d.status} />
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {d.notification_consent && (
                      <button
                        onClick={() => handleSendOptimizeNotification(d)}
                        disabled={sendingDevice === d.device_id}
                        className="inline-flex items-center gap-1 rounded px-2 py-1 font-semibold text-accent hover:bg-accent/10 transition-colors cursor-pointer disabled:opacity-50"
                        title="Send Optimize Notification"
                      >
                        {sendingDevice === d.device_id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <BellRing className="h-3.5 w-3.5" />
                        )}
                        <span>{sendingDevice === d.device_id ? "Sending..." : "Notify"}</span>
                      </button>
                    )}
                    <button
                      onClick={() => setDeletingDevice(d)}
                      className="inline-flex items-center gap-1 rounded px-2 py-1 text-high hover:bg-high/10 hover:text-high transition-colors cursor-pointer font-semibold"
                      title="Delete Device"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Delete</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Future Roadmap Modal Component */}
      <RoadmapModal
        isOpen={!!roadmapDeviceClass}
        onClose={() => setRoadmapDeviceClass(null)}
        deviceClass={roadmapDeviceClass || undefined}
      />
    </div>
  );
}
