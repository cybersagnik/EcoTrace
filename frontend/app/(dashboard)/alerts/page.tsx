"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { useAlerts } from "@/hooks/useAlerts";
import { timeAgo } from "@/utils/date";
import { AlertTriangle, AlertCircle, CheckCircle2, ShieldCheck } from "lucide-react";

export default function AlertsPage() {
  const { alerts, toggleAcknowledge, unacknowledgedCount } = useAlerts();

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Real-time Telemetry Alerts"
        subtitle="Monitored carbon threshold breaches, hardware warnings & automated mitigation logs."
        badge={`${unacknowledgedCount} Unacknowledged`}
      />

      <div className="space-y-4">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={`rounded-card border bg-panel p-5 transition-colors ${
              alert.acknowledged
                ? "border-border opacity-80"
                : alert.severity === "critical"
                ? "border-high/40 bg-high/10"
                : alert.severity === "warning"
                ? "border-amber/40 bg-amber/10"
                : "border-border"
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-2">
              <div className="flex items-start gap-3">
                {alert.severity === "critical" ? (
                  <AlertCircle className="h-5 w-5 text-high shrink-0 mt-0.5" />
                ) : alert.severity === "warning" ? (
                  <AlertTriangle className="h-5 w-5 text-amber shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-blue shrink-0 mt-0.5" />
                )}
                <div>
                  <h3 className="font-display text-sm font-bold text-text flex flex-wrap items-center gap-2">
                    {alert.title}
                    {alert.acknowledged && (
                      <span className="rounded bg-accent/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-accent border border-accent/20">
                        Acknowledged
                      </span>
                    )}
                  </h3>
                  <div className="font-mono text-xs text-text-faint flex items-center gap-2 mt-0.5">
                    <span className="text-accent">{alert.device}</span>
                    <span>•</span>
                    <span>{timeAgo(alert.time)}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => toggleAcknowledge(alert.id)}
                className={`rounded border px-4 py-2 font-mono text-xs font-medium transition-colors cursor-pointer min-h-[44px] shrink-0 ${
                  alert.acknowledged
                    ? "border-accent/30 bg-accent/10 text-accent"
                    : "border-border bg-elevated/70 text-text hover:bg-elevated hover:border-accent/40"
                }`}
              >
                {alert.acknowledged ? (
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5" /> Acknowledged
                  </span>
                ) : (
                  "Acknowledge Alert"
                )}
              </button>
            </div>

            <p className="text-xs text-text-muted leading-relaxed pl-8">{alert.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
