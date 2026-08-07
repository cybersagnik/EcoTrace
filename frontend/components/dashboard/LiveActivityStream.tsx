"use client";

import { useState, useEffect } from "react";
import { formatIndiaTime } from "@/utils/date";
import { Activity, ShieldCheck, Radio, Loader2, AlertTriangle } from "lucide-react";
import { getOverview, OverviewEvent } from "@/services/api/overview";

const POLLING_INTERVAL_MS = 30000;

export function LiveActivityStream() {
  const [events, setEvents] = useState<OverviewEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchEvents = async () => {
      try {
        const res = await getOverview();
        if (!cancelled) {
          setEvents(res.events ?? []);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message ?? String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchEvents();
    const intervalId = setInterval(fetchEvents, POLLING_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, []);

  return (
    <section className="eco-card mb-8 p-6">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Radio className="h-3.5 w-3.5 text-accent" />
          <h2 className="font-display text-base font-semibold text-text">
            Live Telemetry Event Log
          </h2>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs text-text-muted">
          <span className="rounded bg-border px-2 py-0.5 font-semibold text-text-muted border border-border">
            India Time (IST)
          </span>
          {loading && events.length === 0 && (
            <span className="flex items-center gap-1 text-text-muted">
              <Loader2 className="h-3 w-3 animate-spin" /> syncing
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2 font-mono text-xs">
        {error ? (
          <div className="flex items-center gap-2 rounded border border-border bg-bg/50 p-3 text-text-muted">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber" />
            <span>Event stream unavailable: {error}</span>
          </div>
        ) : events.length === 0 ? (
          <div className="rounded border border-border bg-bg/50 p-4 text-center text-text-faint">
            {loading ? "Waiting for first telemetry events…" : "No telemetry events in the last 2 hours."}
          </div>
        ) : (
          events.map((evt) => (
            <div
              key={evt.id}
              className="flex items-start gap-3 rounded border border-border bg-bg/50 p-3 hover:border-accent/40 transition-colors"
            >
              <span className="text-text-faint shrink-0">{formatIndiaTime(evt.time)}</span>
              <span className="font-semibold text-accent shrink-0">{evt.device}</span>
              <span className="text-text-muted flex-1">{evt.event}</span>
              {evt.type === "success" ? (
                <ShieldCheck className="h-3.5 w-3.5 text-success shrink-0" />
              ) : evt.type === "warning" ? (
                <AlertTriangle className="h-3.5 w-3.5 text-amber shrink-0" />
              ) : (
                <Activity className="h-3.5 w-3.5 text-blue shrink-0" />
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
