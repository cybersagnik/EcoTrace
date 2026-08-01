import { Activity } from "lucide-react";

export function LiveIndicator({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-2.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-1.5 font-mono text-xs font-medium text-emerald-400 backdrop-blur-sm">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500 shadow-glow-clean" />
      </span>
      <Activity className="h-3.5 w-3.5 text-emerald-400" />
      <span>{count} telemetry node{count === 1 ? "" : "s"} live</span>
    </div>
  );
}
