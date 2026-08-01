"use client";

import { WifiOff, RefreshCw } from "lucide-react";

interface NoDataStateProps {
  message?: string;
  onRetry?: () => void;
}

export function NoDataState({
  message = "No data — agent may be offline",
  onRetry,
}: NoDataStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-rose-500/30 bg-rose-500/5 p-8 text-center shadow-glass backdrop-blur-glass space-y-3 my-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
        <WifiOff className="h-6 w-6" />
      </div>
      <h3 className="font-display text-sm font-bold text-text">{message}</h3>
      <p className="max-w-md text-xs text-text-muted">
        The telemetry stream returned empty results or experienced an error. Please verify the edge node agent service is running and reporting to NATS.
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 flex items-center gap-2 rounded-xl border border-border/80 bg-elevated/70 px-4 py-2 font-mono text-xs font-medium text-text hover:border-accent/40 hover:text-accent transition-all active:scale-95 cursor-pointer"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Retry Connection</span>
        </button>
      )}
    </div>
  );
}
