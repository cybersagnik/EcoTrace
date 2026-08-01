"use client";

import { DeviceStatus as DeviceStatusType } from "@/types/device";
import { IntensityLevel } from "@/types/common";
import { CheckCircle2, AlertTriangle, XCircle, Sparkles, Flame, ShieldCheck, Clock } from "lucide-react";

export function StatusBadge({ status }: { status?: DeviceStatusType | string }) {
  const normalizedStatus = status?.toLowerCase();

  if (normalizedStatus === "operating") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-2.5 py-1 text-xs font-medium text-success border border-success/30 shadow-glow-clean">
        <CheckCircle2 className="h-3 w-3" />
        <span>Operating</span>
      </span>
    );
  }

  if (normalizedStatus === "registering") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-400 border border-amber-500/20">
        <AlertTriangle className="h-3 w-3" />
        <span>Registering</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-400 border border-rose-500/20">
      <XCircle className="h-3 w-3" />
      <span>Offline</span>
    </span>
  );
}

export function IntensityBadge({ level }: { level?: IntensityLevel | string }) {
  const normalizedLevel = level?.toLowerCase();

  if (normalizedLevel === "clean") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-success/15 px-2.5 py-0.5 font-mono text-xs font-semibold text-success border border-success/30">
        <ShieldCheck className="h-3 w-3 text-success" />
        Clean (&lt;250g)
      </span>
    );
  }

  if (normalizedLevel === "moderate") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/15 px-2.5 py-0.5 font-mono text-xs font-semibold text-amber-400 border border-amber-500/30">
        <Sparkles className="h-3 w-3 text-amber-400" />
        Moderate (250-500g)
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-rose-500/15 px-2.5 py-0.5 font-mono text-xs font-semibold text-rose-400 border border-rose-500/30">
      <Flame className="h-3 w-3 text-rose-400" />
      High (&gt;500g)
    </span>
  );
}

export function ComingSoonBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-400 border border-amber-500/30 shadow-sm animate-pulse">
      <Clock className="h-3 w-3" />
      <span>Coming Soon</span>
    </span>
  );
}

export function DeviceStatus({ status }: { status?: DeviceStatusType | string }) {
  return <StatusBadge status={status} />;
}

export default StatusBadge;

