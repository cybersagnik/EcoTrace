import { Activity } from "lucide-react";

export function LiveIndicator({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-2 font-mono text-xs text-text-muted">
      <span className="h-1.5 w-1.5 rounded-full bg-success" />
      <Activity className="h-3.5 w-3.5 text-success" />
      <span className="tabular-nums">{count}</span>
      <span>telemetry node{count === 1 ? "" : "s"} live</span>
    </div>
  );
}
