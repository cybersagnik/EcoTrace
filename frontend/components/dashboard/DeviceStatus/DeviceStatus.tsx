"use client";

import { DeviceStatus as DeviceStatusType } from "@/types/device";
import { IntensityLevel } from "@/types/common";
import { Clock } from "lucide-react";

export function StatusBadge({ status }: { status?: DeviceStatusType | string }) {
  const normalizedStatus = status?.toLowerCase();

  if (normalizedStatus === "operating") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
        <span className="h-1.5 w-1.5 rounded-full bg-success" />
        <span>Operating</span>
      </span>
    );
  }

  if (normalizedStatus === "registering") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-moderate">
        <span className="h-1.5 w-1.5 rounded-full bg-moderate" />
        <span>Registering</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-high">
      <span className="h-1.5 w-1.5 rounded-full bg-high" />
      <span>Offline</span>
    </span>
  );
}

export function IntensityBadge({ level }: { level?: IntensityLevel | string }) {
  const normalizedLevel = level?.toLowerCase();

  if (normalizedLevel === "clean") {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-success">
        <span className="h-1.5 w-1.5 rounded-full bg-success" />
        Clean (&lt;250g)
      </span>
    );
  }

  if (normalizedLevel === "moderate") {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-moderate">
        <span className="h-1.5 w-1.5 rounded-full bg-moderate" />
        Moderate (250-500g)
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-high">
      <span className="h-1.5 w-1.5 rounded-full bg-high" />
      High (&gt;500g)
    </span>
  );
}

export function ComingSoonBadge() {
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold text-moderate">
      <Clock className="h-3 w-3" />
      <span>Coming Soon</span>
    </span>
  );
}

export function DeviceStatus({ status }: { status?: DeviceStatusType | string }) {
  return <StatusBadge status={status} />;
}

export default StatusBadge;
