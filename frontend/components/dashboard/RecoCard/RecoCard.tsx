"use client";

import { useState } from "react";
import { Recommendation } from "@/types/recommendation";
import { Sparkles, ArrowRight, Zap, CheckCircle2, Leaf } from "lucide-react";

interface RecoCardProps {
  recommendations?: Recommendation[];
  totalSavingsKg?: number;
  loading?: boolean;
}

export function RecoCard({
  recommendations = [],
  totalSavingsKg = 41.2,
  loading = false,
}: RecoCardProps) {
  const [appliedIds, setAppliedIds] = useState<Record<string, boolean>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleApply = (reco: Recommendation) => {
    setAppliedIds((prev) => ({ ...prev, [reco.id]: true }));
    setToastMessage(`Applied optimization: ${reco.title} (Saved ${reco.impact_kg} kg CO2e)`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  if (loading) {
    return (
      <section className="eco-card mb-8 p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-48 bg-border rounded" />
          <div className="h-20 w-full bg-border/50 rounded" />
        </div>
      </section>
    );
  }

  if (!recommendations || recommendations.length === 0) {
    return null;
  }

  return (
    <section className="eco-card mb-8 p-6">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded border border-success/40 bg-panel p-4 text-success font-mono text-xs">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Reco Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded border border-border bg-bg/60 text-accent">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-display text-base font-semibold text-text flex items-center gap-2">
              Automated Carbon Optimization Insights
              <span className="rounded bg-border px-2.5 py-0.5 font-mono text-[11px] font-semibold text-success border border-border">
                Reco Engine Active
              </span>
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              Real-time grid intensity recommendations generated from WattTime telemetry.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded border border-success/30 bg-bg/60 px-3 py-1.5 font-mono text-xs text-success font-semibold">
          <Leaf className="h-3.5 w-3.5" />
          <span>Save up to {totalSavingsKg} kg CO2e / day</span>
        </div>
      </div>

      {/* Recommendations Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {recommendations.map((reco) => {
          const isApplied = appliedIds[reco.id];
          return (
            <div
              key={reco.id}
              className={`flex flex-col justify-between rounded border p-5 transition-colors duration-150 ${
                isApplied
                  ? "border-success/40 bg-bg/60 opacity-80"
                  : reco.priority === "critical"
                  ? "border-high/40 bg-bg/40"
                  : "border-border bg-panel"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span
                    className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em] ${
                      reco.priority === "critical"
                        ? "bg-high/10 text-high border border-high/30"
                        : reco.priority === "high"
                        ? "bg-amber/10 text-amber border border-amber/30"
                        : "bg-blue/10 text-blue border border-blue/30"
                    }`}
                  >
                    {reco.priority} priority
                  </span>
                  <span className="font-mono text-xs font-bold text-success flex items-center gap-1">
                    <Zap className="h-3 w-3" /> -{reco.impact_kg} kg
                  </span>
                </div>

                <h3 className="font-display text-sm font-semibold text-text mb-2 leading-snug">
                  {reco.title}
                </h3>
                <p className="text-xs text-text-muted leading-relaxed mb-4">
                  {reco.description}
                </p>
              </div>

              <div className="border-t border-border pt-3 flex items-center justify-between">
                <span className="font-mono text-[11px] text-text-faint">{reco.region} Grid</span>
                <button
                  onClick={() => handleApply(reco)}
                  disabled={isApplied}
                  className={`flex items-center gap-1.5 rounded px-3.5 py-1.5 font-mono text-xs font-semibold transition-colors cursor-pointer ${
                    isApplied
                      ? "bg-border/50 text-success border border-success/30 cursor-default"
                      : "bg-accent text-white hover:bg-accent-hover border border-accent"
                  }`}
                >
                  {isApplied ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Optimized</span>
                    </>
                  ) : (
                    <>
                      <span>{reco.action_label}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
