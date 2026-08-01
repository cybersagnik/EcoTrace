"use client";

import { useState, useEffect } from "react";
import { formatIndiaTime } from "@/utils/date";
import { Activity, ShieldCheck, Radio } from "lucide-react";

export function LiveActivityStream() {
  const [events, setEvents] = useState<Array<{ id: number; time: string; device: string; event: string; type: string }>>([]);

  useEffect(() => {
    const now = Date.now();
    setEvents([
      {
        id: 1,
        time: formatIndiaTime(new Date(now - 120000)),
        device: "edge-us-east-01",
        event: "Grid carbon intensity auto-matched via WattTime API",
        type: "info",
      },
      {
        id: 2,
        time: formatIndiaTime(new Date(now - 300000)),
        device: "datacenter-eu-west-04",
        event: "Solar battery discharge initiated (saved 14.2kg CO2e)",
        type: "success",
      },
      {
        id: 3,
        time: formatIndiaTime(new Date(now - 600000)),
        device: "iot-gateway-ap-south",
        event: "Telemetry payload heartbeat synced — 240gCO2/kWh",
        type: "info",
      },
    ]);
  }, []);

  return (
    <section className="eco-card rounded-[24px] border border-border bg-panel-solid dark:bg-[#0F172A] bg-white p-6 shadow-sm transition-all duration-300">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-emerald-400 animate-pulse" />
          <h2 className="font-display text-base font-bold text-text">
            Live Telemetry Event Log
          </h2>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs text-text-faint">
          <span className="rounded bg-indigo-500/10 px-2 py-0.5 font-semibold text-indigo-400 border border-indigo-500/20">
            India Time (IST)
          </span>
        </div>
      </div>

      <div className="space-y-3 font-mono text-xs">
        {events.map((evt) => (
          <div
            key={evt.id}
            className="flex items-start gap-3 rounded-lg border border-border/40 bg-bg/50 p-3 hover:border-accent/30 transition-all"
          >
            <span className="text-text-faint shrink-0">{evt.time}</span>
            <span className="font-semibold text-accent shrink-0">{evt.device}</span>
            <span className="text-text-muted flex-1">{evt.event}</span>
            {evt.type === "success" ? (
              <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
            ) : (
              <Activity className="h-4 w-4 text-sky-400 shrink-0" />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
