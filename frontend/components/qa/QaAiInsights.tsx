"use client";

import { useMemo, useState } from "react";
import { Sparkles, Loader2, AlertCircle, AlertTriangle, Info } from "lucide-react";
import { useQaDashboard } from "@/features/qa/QaDashboardProvider";
import { Card } from "@/components/ui/Card";
import { cn } from "@/utils/helpers";
import { analyzeQa, AnalyzeQaInput, QaAiFinding } from "@/services/api/ai";
import { IssueCode } from "@/types/telemetry";

const SEVERITY_ICONS: Record<QaAiFinding["severity"], typeof AlertCircle> = {
  critical: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const SEVERITY_STYLES: Record<QaAiFinding["severity"], { icon: string; ring: string; badge: string }> = {
  critical: {
    icon: "text-high",
    ring: "border-high/40 bg-high/10",
    badge: "border-high/30 text-high",
  },
  warning: {
    icon: "text-moderate",
    ring: "border-moderate/40 bg-moderate/10",
    badge: "border-moderate/30 text-moderate",
  },
  info: {
    icon: "text-info",
    ring: "border-info/40 bg-info/10",
    badge: "border-info/30 text-info",
  },
};

function summaryOf(rows: ReturnType<typeof useQaDashboard>["rows"], issues: ReturnType<typeof useQaDashboard>["issues"]) {
  const agg = {
    totalEnergyWh: 0,
    totalCarbonG: 0,
    cpuSum: 0,
    memSum: 0,
  };
  rows.forEach((r) => {
    agg.totalEnergyWh += r.energyWh || 0;
    agg.totalCarbonG += r.carbonG || 0;
    agg.cpuSum += r.cpuUsagePct || 0;
    agg.memSum += r.memoryUsagePct || 0;
  });

  const byDevice = new Map<string, { rows: number; carbonG: number; energyWh: number }>();
  const byFleet = new Map<string, { rows: number; carbonG: number; energyWh: number }>();
  const byRegion = new Map<string, { rows: number; carbonG: number; energyWh: number }>();
  rows.forEach((r) => {
    const push = (map: Map<string, { rows: number; carbonG: number; energyWh: number }>, key: string) => {
      const e = map.get(key) ?? { rows: 0, carbonG: 0, energyWh: 0 };
      e.rows += 1;
      e.carbonG += r.carbonG || 0;
      e.energyWh += r.energyWh || 0;
      map.set(key, e);
    };
    push(byDevice, r.deviceId);
    push(byFleet, r.fleetName || "uncategorized");
    push(byRegion, r.gridRegion || "unknown");
  });

  const issuesByCode = new Map<IssueCode, number>();
  issues.forEach((i) => issuesByCode.set(i.code, (issuesByCode.get(i.code) ?? 0) + 1));

  return {
    row_count: rows.length,
    total_energy_wh: Math.round(agg.totalEnergyWh),
    total_carbon_g: Math.round(agg.totalCarbonG),
    avg_cpu_pct: rows.length ? +((agg.cpuSum / rows.length).toFixed(1)) : 0,
    avg_mem_pct: rows.length ? +((agg.memSum / rows.length).toFixed(1)) : 0,
    by_device: Array.from(byDevice.entries()).map(([k, v]) => ({ device: k, ...v })),
    by_fleet: Array.from(byFleet.entries()).map(([k, v]) => ({ fleet: k, ...v })),
    by_region: Array.from(byRegion.entries()).map(([k, v]) => ({ region: k, ...v })),
    issues_by_code: Array.from(issuesByCode.entries()).map(([code, count]) => ({ code, count })),
    issue_counts: {
      error: issues.filter((i) => i.severity === "error").length,
      warning: issues.filter((i) => i.severity === "warning").length,
      info: issues.filter((i) => i.severity === "info").length,
    },
  };
}

export function QaAiInsights() {
  const { rows, issues, sourceInfo, score, hasDataset } = useQaDashboard();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [findings, setFindings] = useState<QaAiFinding[]>([]);

  const summary = useMemo(() => summaryOf(rows, issues), [rows, issues]);

  const runAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload: AnalyzeQaInput = {
        structured: {
          source_info: sourceInfo,
          quality_score: {
            score: score.score,
            zone: score.zone,
            max: 100,
          },
          ...summary,
        },
      };
      const res = await analyzeQa(payload);
      setFindings(res.findings ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  if (!hasDataset) return null;

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-blue" />
          <h3 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            AI Sustainability Analysis
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={runAnalysis}
            disabled={loading}
            className="flex items-center gap-2 rounded border border-blue/40 bg-blue/10 px-4 py-2 font-mono text-xs font-medium text-blue transition-colors hover:bg-blue/20 disabled:opacity-50 cursor-pointer"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {loading ? "Analyzing…" : "Analyze with AI"}
          </button>
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded border border-high/40 bg-high/10 px-3 py-2 text-xs text-high">
          Analysis failed: {error}
        </p>
      )}

      {findings.length === 0 && !loading && !error && (
        <p className="py-4 text-center font-mono text-xs text-text-faint">
          Send this dataset to the AI advisor for bespoke carbon-wastage and data-quality findings.
        </p>
      )}

      {findings.length > 0 && (
        <div className="space-y-3">
          {findings.map((f, idx) => {
            const Icon = SEVERITY_ICONS[f.severity];
            const style = SEVERITY_STYLES[f.severity];
            return (
              <div key={idx} className={cn("rounded border p-4", style.ring)}>
                <div className="flex items-start gap-3">
                  <Icon className={cn("h-4 w-4 shrink-0 mt-0.5", style.icon)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-display text-sm font-bold text-text">{f.issue}</h4>
                      <span className={cn("rounded border px-2 py-0.5 font-mono text-[10px] uppercase", style.badge)}>
                        {f.severity}
                      </span>
                      {typeof f.confidence === "number" && (
                        <span className="font-mono text-[10px] text-text-faint">
                          {Math.round(f.confidence * 100)}% confidence
                        </span>
                      )}
                    </div>
                    {f.evidence && (
                      <p className="mt-1.5 text-xs text-text-muted leading-relaxed">{f.evidence}</p>
                    )}
                    <p className="mt-2 rounded bg-panel px-3 py-2 text-xs text-text-muted leading-relaxed">
                      <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-blue">
                        Recommendation
                      </span>
                      <span className="mt-0.5 block">{f.recommendation}</span>
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}