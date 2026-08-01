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
      <section className="mb-8 rounded-card border border-border bg-panel-solid dark:bg-[#111b24] bg-white p-6 shadow-level-1">
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-48 bg-border/60 rounded" />
          <div className="h-20 w-full bg-border/40 rounded-xl" />
        </div>
      </section>
    );
  }

  if (!recommendations || recommendations.length === 0) {
    return null;
  }

  return (
    <section className="mb-8 rounded-[24px] border border-[#16A34A]/25 bg-panel-solid dark:bg-[#0F172A] bg-white p-6 shadow-sm relative overflow-hidden">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-[16px] border border-[#22C55E]/30 bg-panel-solid dark:bg-[#0F172A] bg-white p-4 shadow-lg text-[#22C55E] font-mono text-xs animate-bounce">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-[#22C55E]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Reco Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-border/40 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#16A34A]/15 text-[#16A34A] border border-[#16A34A]/20">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-display text-base font-bold text-text flex items-center gap-2">
              Automated Carbon Optimization Insights
              <span className="rounded-full bg-[#22C55E]/15 px-2.5 py-0.5 font-mono text-xs font-semibold text-[#22C55E] border border-[#22C55E]/30">
                Reco Engine Active
              </span>
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              Real-time grid intensity recommendations generated from WattTime telemetry.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-[16px] bg-[#22C55E]/10 border border-[#22C55E]/20 px-4 py-2 font-mono text-xs text-[#22C55E] font-bold">
          <Leaf className="h-3.5 w-3.5 text-[#22C55E]" />
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
              className={`eco-card flex flex-col justify-between rounded-[20px] border p-5 transition-all duration-300 ease-out hover:-translate-y-[6px] hover:shadow-md ${
                isApplied
                  ? "border-[#22C55E]/40 bg-[#22C55E]/10 dark:bg-[#22C55E]/10 opacity-80"
                  : reco.priority === "critical"
                  ? "border-[#16A34A]/40 bg-[#16A34A]/5 dark:bg-[#16A34A]/10 hover:border-[#16A34A]/60"
                  : "border-border/80 bg-panel-solid dark:bg-[#1E293B] bg-white hover:border-border shadow-sm"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span
                    className={`rounded-lg px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${
                      reco.priority === "critical"
                        ? "bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/30"
                        : reco.priority === "high"
                        ? "bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/30"
                        : "bg-[#0EA5E9]/10 text-[#0EA5E9] border border-[#0EA5E9]/30"
                    }`}
                  >
                    {reco.priority} priority
                  </span>
                  <span className="font-mono text-xs font-bold text-[#22C55E] flex items-center gap-1">
                    <Zap className="h-3 w-3" /> -{reco.impact_kg} kg
                  </span>
                </div>

                <h3 className="font-display text-sm font-bold text-text mb-2 leading-snug">
                  {reco.title}
                </h3>
                <p className="text-xs text-text-muted leading-relaxed mb-4">
                  {reco.description}
                </p>
              </div>

              <div className="border-t border-border/40 pt-3 flex items-center justify-between">
                <span className="font-mono text-[11px] text-text-faint">{reco.region} Grid</span>
                <button
                  onClick={() => handleApply(reco)}
                  disabled={isApplied}
                  className={`btn-primary flex items-center gap-1.5 rounded-[16px] px-3.5 py-1.5 font-mono text-xs font-semibold transition-all active:scale-95 cursor-pointer ${
                    isApplied
                      ? "bg-[#22C55E]/20 text-[#22C55E] border border-[#22C55E]/30 cursor-default shadow-none hover:bg-[#22C55E]/20"
                      : "bg-[#16A34A] text-white hover:bg-[#15803D]"
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
