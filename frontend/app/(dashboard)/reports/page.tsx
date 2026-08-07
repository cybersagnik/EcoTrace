"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { useFleet } from "@/hooks/useFleet";
import { useDevices } from "@/hooks/useDevices";
import { getSessionToken } from "@/lib/auth";
import {
  FileText,
  Download,
  ShieldCheck,
  FileSpreadsheet,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Cpu,
} from "lucide-react";

interface ReportMeta {
  name: string;
  description: string;
  icon: typeof FileText;
  format: "pdf" | "csv";
  accent: string;
}

const REPORTS: ReportMeta[] = [
  {
    name: "Executive Compliance Audit Report",
    description: "Full Scope 1 & 2 carbon accounting report covering every fleet, device, and daily emissions figure.",
    icon: FileText,
    format: "pdf",
    accent: "emerald",
  },
  {
    name: "Raw IoT Telemetry Export",
    description: "CSV dataset with hourly power draw, carbon intensity, CPU/memory/network metrics, and fleet assignments for custom BI tools.",
    icon: FileSpreadsheet,
    format: "csv",
    accent: "sky",
  },
];

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

async function fetchReport(
  endpoint: string,
  fallbackName: string,
  format: "pdf" | "csv"
): Promise<{ blob: Blob; filename: string; size: number }> {
  const token = getSessionToken();
  const res = await fetch(endpoint, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  const blob = await res.blob();
  const dispo = res.headers.get("Content-Disposition") ?? "";
  const match = dispo.match(/filename="?([^";]+)"?/);
  const filename = match?.[1] ?? `${fallbackName}-${Date.now()}.${format}`;
  return { blob, filename, size: blob.size };
}

export default function ReportsPage() {
  const { fleet } = useFleet();
  const { devices } = useDevices({ category: "endpoint", pollingIntervalMs: 60000 });
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadMeta, setDownloadMeta] = useState<Record<string, { size: number; filename: string; ts: number } | null>>({});
  const [error, setError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const handleDownload = async (report: ReportMeta) => {
    setError(null);
    setDownloading(report.name);
    try {
      const endpoint = report.format === "csv" ? "/api/reports/csv?days=30" : "/api/reports/pdf";
      const result = await fetchReport(endpoint, report.name, report.format);
      downloadBlob(result.blob, result.filename);
      setDownloadMeta((prev) => ({
        ...prev,
        [report.name]: { size: result.size, filename: result.filename, ts: Date.now() },
      }));
      showToast(`Downloaded ${result.filename} (${formatBytes(result.size)})`);
    } catch (err) {
      setError((err as Error).message ?? "Download failed");
    } finally {
      setDownloading(null);
    }
  };

  // Reset download meta after 60s so it doesn't look stale
  useEffect(() => {
    if (Object.keys(downloadMeta).length === 0) return;
    const id = setInterval(() => {
      const now = Date.now();
      setDownloadMeta((prev) => {
        const next: typeof prev = {};
        for (const [k, v] of Object.entries(prev)) {
          if (v && now - v.ts < 60_000) next[k] = v;
        }
        return next;
      });
    }, 10_000);
    return () => clearInterval(id);
  }, [downloadMeta]);

  const deviceCount = devices?.length ?? 0;
  const totalCarbonKg = fleet?.summary.total_carbon_kg ?? 0;
  const fleetCount = fleet?.regions?.length ?? 0;

  return (
    <div className="space-y-8 animate-fade-in relative">
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded border border-accent/30 bg-panel p-4 text-success font-mono text-xs">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
          <span>{toastMsg}</span>
        </div>
      )}

      <PageHeader
        title="Sustainability Reports & Audit Logs"
        subtitle="Generate automated compliance reports for ESG disclosures, SEC climate rules & ISO 14064 — built from live agent telemetry."
        action={
          <button
            onClick={() => handleDownload(REPORTS[0])}
            disabled={downloading === REPORTS[0].name}
            className="flex items-center gap-2 rounded bg-accent px-4 py-2 font-mono text-xs font-semibold text-bg hover:bg-accent-hover transition-colors disabled:opacity-60 cursor-pointer"
          >
            {downloading === REPORTS[0].name ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            <span>{downloading === REPORTS[0].name ? "Generating..." : "Generate Audit PDF"}</span>
          </button>
        }
      />

      {/* Real-data context bar */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded border border-border bg-panel p-5 flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded bg-accent/10 text-success">
            <Cpu className="h-5 w-5" />
          </div>
          <div>
            <div className="font-mono text-xl font-bold text-text">{deviceCount}</div>
            <div className="text-xs text-text-muted">Active agents feeding the data</div>
          </div>
        </div>
        <div className="rounded border border-border bg-panel p-5 flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded bg-blue/10 text-blue">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <div className="font-mono text-xl font-bold text-text">{fleetCount}</div>
            <div className="text-xs text-text-muted">Fleet(s) represented in reports</div>
          </div>
        </div>
        <div className="rounded border border-border bg-panel p-5 flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded bg-amber/10 text-amber">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="font-mono text-xl font-bold text-text">
              {totalCarbonKg.toFixed(3)} kg
            </div>
            <div className="text-xs text-text-muted">CO2e tracked today</div>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded border border-high/30 bg-high/10 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-high shrink-0 mt-0.5" />
          <div className="font-mono text-xs text-high">{error}</div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {REPORTS.map((report) => {
          const Icon = report.icon;
          const meta = downloadMeta[report.name];
          const isDownloading = downloading === report.name;
          return (
            <div
              key={report.name}
              className="rounded-card border border-border bg-panel p-6 space-y-4"
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={`h-5 w-5 ${report.accent === "emerald" ? "text-success" : "text-blue"}`}
                />
                <h3 className="font-display text-base font-bold text-text">{report.name}</h3>
              </div>
              <p className="text-xs text-text-muted leading-relaxed">{report.description}</p>
              <div className="flex items-center justify-between border-t border-border pt-4 font-mono text-xs text-text-faint">
                <span className="text-success flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4" />
                  {report.format === "pdf" ? "Generated server-side" : "Last 30 days · live data"}
                </span>
                <button
                  onClick={() => handleDownload(report)}
                  disabled={isDownloading}
                  className={`flex items-center gap-1 font-semibold transition-colors cursor-pointer disabled:opacity-60 ${
                    report.accent === "emerald" ? "text-accent hover:underline" : "text-success hover:underline"
                  }`}
                >
                  {isDownloading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Generating...</span>
                    </>
                  ) : meta ? (
                    <>
                      <Download className="h-3.5 w-3.5" />
                      <span>Download {report.format.toUpperCase()} ({formatBytes(meta.size)})</span>
                    </>
                  ) : (
                    <>
                      <Download className="h-3.5 w-3.5" />
                      <span>Download {report.format.toUpperCase()}</span>
                    </>
                  )}
                </button>
              </div>
              {meta && (
                <div className="text-[10px] text-text-faint font-mono border-t border-border pt-2">
                  Last generated: {new Date(meta.ts).toLocaleTimeString()} · {meta.filename}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded border border-border bg-panel p-4 text-[11px] text-text-muted font-mono leading-relaxed">
        <span className="text-text-faint font-semibold">Source of truth:</span> Both reports
        query the live <code className="text-accent">devices</code>,{" "}
        <code className="text-accent">fleets</code>,{" "}
        <code className="text-accent">emissions_calculated</code>, and{" "}
        <code className="text-accent">emissions_raw</code> tables — the same telemetry
        stream that powers the live dashboard. No mock data.
      </div>
    </div>
  );
}
