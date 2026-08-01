"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { downloadCSVReport, downloadPDFReport } from "@/utils/export";
import { FileText, Download, ShieldCheck, FileSpreadsheet, CheckCircle2, Sparkles } from "lucide-react";

export default function ReportsPage() {
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleGenerateAuditPDF = () => {
    downloadPDFReport("Executive Compliance Audit Report");
    showToast("Successfully generated and downloaded Executive Audit PDF!");
  };

  const handleDownloadESG = () => {
    downloadPDFReport("Monthly ESG Disclosure - July 2026");
    showToast("Downloading Monthly ESG Disclosure PDF...");
  };

  const handleDownloadCSV = () => {
    downloadCSVReport();
    showToast("Downloading Raw IoT Telemetry Dataset (CSV)...");
  };

  return (
    <div className="space-y-8 animate-fade-in relative">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-panel-solid p-4 shadow-glass backdrop-blur-glass text-emerald-400 font-mono text-xs animate-bounce">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      <PageHeader
        title="Sustainability Reports & Audit Logs"
        subtitle="Generate automated compliance reports for ESG disclosures, SEC climate rules & ISO 14064."
        action={
          <button
            onClick={handleGenerateAuditPDF}
            className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2 font-mono text-xs font-semibold text-bg hover:bg-sky-400 transition-all shadow-glow active:scale-95"
          >
            <Download className="h-4 w-4" />
            <span>Generate New Audit PDF</span>
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-card border border-border bg-panel-solid dark:bg-[#111b24] bg-white p-6 shadow-level-1 space-y-4">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-accent" />
            <h3 className="font-display text-base font-bold text-text">Monthly ESG Disclosure (July 2026)</h3>
          </div>
          <p className="text-xs text-text-muted leading-relaxed">
            Full Scope 1 & 2 carbon accounting compliance report verified by automated telemetry logs.
          </p>
          <div className="flex items-center justify-between border-t border-border/40 pt-4 font-mono text-xs text-text-faint">
            <span className="text-emerald-400 flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4" /> Verified Compliant
            </span>
            <button
              onClick={handleDownloadESG}
              className="text-accent hover:underline flex items-center gap-1 font-semibold transition-all active:scale-95 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" /> Download PDF (2.4 MB)
            </button>
          </div>
        </div>

        <div className="rounded-card border border-border bg-panel-solid dark:bg-[#111b24] bg-white p-6 shadow-level-1 space-y-4">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
            <h3 className="font-display text-base font-bold text-text">Raw IoT Telemetry Export</h3>
          </div>
          <p className="text-xs text-text-muted leading-relaxed">
            CSV dataset containing hourly power draw, carbon intensity, and device health metrics for custom BI tools.
          </p>
          <div className="flex items-center justify-between border-t border-border/40 pt-4 font-mono text-xs text-text-faint">
            <span>Last 30 Days</span>
            <button
              onClick={handleDownloadCSV}
              className="text-emerald-400 hover:underline flex items-center gap-1 font-semibold transition-all active:scale-95 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" /> Download CSV (14 MB)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
