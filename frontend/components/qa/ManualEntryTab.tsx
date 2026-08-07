"use client";

import { useState } from "react";
import { PlusCircle, CheckCircle2 } from "lucide-react";
import { useQaDashboard } from "@/features/qa/QaDashboardProvider";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import {
  AttributionModel,
  DeviceClass,
  DeviceOs,
  DeviceStatus,
  TelemetryRow,
} from "@/types/telemetry";

interface ManualRowForm {
  timestamp: string;
  deviceId: string;
  deviceClass: string;
  os: string;
  hostname: string;
  fleetId: string;
  fleetName: string;
  gridRegion: string;
  energyWh: string;
  carbonG: string;
  cpuUsagePct: string;
  memoryUsagePct: string;
  networkSentBytes: string;
  networkReceivedBytes: string;
  deviceStatus: string;
  attributionModel: string;
}

const EMPTY_FORM: ManualRowForm = {
  timestamp: "",
  deviceId: "",
  deviceClass: DeviceClass.LinuxServer,
  os: DeviceOs.Linux,
  hostname: "",
  fleetId: "",
  fleetName: "",
  gridRegion: "",
  energyWh: "100",
  carbonG: "12.5",
  cpuUsagePct: "15",
  memoryUsagePct: "40",
  networkSentBytes: "0",
  networkReceivedBytes: "0",
  deviceStatus: DeviceStatus.Active,
  attributionModel: AttributionModel.V03,
};

const num = (v: string): number => {
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

const emptyOrNull = (v: string): string | null => (v.trim() === "" ? null : v.trim());

export function ManualEntryTab() {
  const { addManualRows, setActiveTab } = useQaDashboard();
  const [form, setForm] = useState<ManualRowForm>(EMPTY_FORM);
  const [added, setAdded] = useState(false);

  const set = (key: keyof ManualRowForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setAdded(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const row: TelemetryRow = {
      rowIndex: 0,
      timestamp: form.timestamp ? new Date(form.timestamp).toISOString() : "",
      deviceId: form.deviceId.trim(),
      deviceClass: form.deviceClass.toLowerCase(),
      os: form.os.toLowerCase(),
      hostname: form.hostname.trim(),
      fleetId: emptyOrNull(form.fleetId),
      fleetName: emptyOrNull(form.fleetName),
      gridRegion: emptyOrNull(form.gridRegion),
      energyWh: num(form.energyWh),
      carbonG: num(form.carbonG),
      cpuUsagePct: num(form.cpuUsagePct),
      memoryUsagePct: num(form.memoryUsagePct),
      networkSentBytes: num(form.networkSentBytes),
      networkReceivedBytes: num(form.networkReceivedBytes),
      deviceStatus: form.deviceStatus.toLowerCase(),
      attributionModel: form.attributionModel.toLowerCase(),
    };
    addManualRows([row]);
    setForm(EMPTY_FORM);
    setAdded(true);
  };

  const inputCls = "w-full min-h-[36px]";
  const labelCls = "font-mono text-[10px] uppercase tracking-wider text-text-faint";

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <PlusCircle className="h-3.5 w-3.5 text-accent" />
            <h3 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              Add a single telemetry row
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-3">
              <label className={labelCls}>Timestamp (local)</label>
              <Input type="datetime-local" required value={form.timestamp} onChange={set("timestamp")} className={inputCls} />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Device ID *</label>
              <Input required value={form.deviceId} onChange={set("deviceId")} placeholder="edge-node-04" className={inputCls} />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Device Class</label>
              <select value={form.deviceClass} onChange={set("deviceClass")} className="min-h-[36px] rounded-md border border-border bg-elevated px-3 py-2 text-sm text-text focus:border-accent cursor-pointer">
                {Object.values(DeviceClass).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>OS</label>
              <select value={form.os} onChange={set("os")} className="min-h-[36px] rounded-md border border-border bg-elevated px-3 py-2 text-sm text-text focus:border-accent cursor-pointer">
                {Object.values(DeviceOs).map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Hostname</label>
              <Input value={form.hostname} onChange={set("hostname")} placeholder="edge-04" className={inputCls} />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Fleet ID</label>
              <Input value={form.fleetId} onChange={set("fleetId")} placeholder="flt-in-kol (optional)" className={inputCls} />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Fleet Name</label>
              <Input value={form.fleetName} onChange={set("fleetName")} placeholder="INFOTRICS (optional)" className={inputCls} />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Grid Region</label>
              <Input value={form.gridRegion} onChange={set("gridRegion")} placeholder="IN-KOL (optional)" className={inputCls} />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Status</label>
              <select value={form.deviceStatus} onChange={set("deviceStatus")} className="min-h-[36px] rounded-md border border-border bg-elevated px-3 py-2 text-sm text-text focus:border-accent cursor-pointer">
                {Object.values(DeviceStatus).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Attribution Model</label>
              <select value={form.attributionModel} onChange={set("attributionModel")} className="min-h-[36px] rounded-md border border-border bg-elevated px-3 py-2 text-sm text-text focus:border-accent cursor-pointer">
                {Object.values(AttributionModel).map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Energy (Wh)</label>
              <Input type="number" min="0" step="any" value={form.energyWh} onChange={set("energyWh")} className={inputCls} />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Carbon (g)</label>
              <Input type="number" min="0" step="any" value={form.carbonG} onChange={set("carbonG")} className={inputCls} />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>CPU (%)</label>
              <Input type="number" min="0" max="100" step="any" value={form.cpuUsagePct} onChange={set("cpuUsagePct")} className={inputCls} />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Memory (%)</label>
              <Input type="number" min="0" max="100" step="any" value={form.memoryUsagePct} onChange={set("memoryUsagePct")} className={inputCls} />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Net Sent (B)</label>
              <Input type="number" min="0" step="any" value={form.networkSentBytes} onChange={set("networkSentBytes")} className={inputCls} />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Net Recv (B)</label>
              <Input type="number" min="0" step="any" value={form.networkReceivedBytes} onChange={set("networkReceivedBytes")} className={inputCls} />
            </div>
          </div>

          <div className="flex items-center gap-3 border-t border-border pt-4">
            <Button type="submit" variant="primary">
              <span className="flex items-center gap-2">
                <PlusCircle className="h-4 w-4" />
                Add Row
              </span>
            </Button>
            {added && (
              <span className="flex items-center gap-1.5 font-mono text-xs text-success">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Row added — run validation against it below
              </span>
            )}
            <button
              type="button"
              onClick={() => setActiveTab("csv")}
              className="ml-auto font-mono text-xs text-text-muted underline-offset-2 hover:text-accent hover:underline cursor-pointer"
            >
              Back to CSV import
            </button>
          </div>
        </form>
      </Card>

      <div className="space-y-3">
        <Card className="p-5">
          <h3 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            Manual entry notes
          </h3>
          <ul className="mt-3 space-y-2 text-xs text-text-muted">
            <li>Rows added here run through the same 16 validation checks as CSV imports.</li>
            <li>Empty Fleet ID / Fleet Name / Grid Region are treated as <span className="font-mono text-moderate">warnings</span> (unassigned).</li>
            <li>Values outside allowed ranges (CPU/memory &gt;100) are <span className="font-mono text-high">errors</span>.</li>
            <li>Manual rows are appended to the current dataset and persisted locally.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
