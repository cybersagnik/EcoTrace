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
    <div className="flex flex-col items-center justify-center rounded-card border border-border bg-panel p-8 text-center space-y-3 my-4">
      <div className="flex h-10 w-10 items-center justify-center rounded bg-elevated text-text-muted border border-border">
        <WifiOff className="h-5 w-5" />
      </div>
      <h3 className="font-display text-sm font-semibold text-text">{message}</h3>
      <p className="max-w-md text-xs text-text-muted">
        The telemetry stream returned empty results or experienced an error. Please verify the edge node agent service is running and reporting to NATS.
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 flex items-center gap-2 rounded border border-border bg-elevated px-4 py-2 font-mono text-xs font-medium text-text hover:border-accent/40 hover:text-accent transition-colors cursor-pointer"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Retry Connection</span>
        </button>
      )}
    </div>
  );
}
