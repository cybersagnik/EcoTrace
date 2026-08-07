"use client";

import React, { useState } from "react";
import { Cpu, Zap, Radio, CheckCircle2, Clock, X, ArrowRight, Shield } from "lucide-react";
import { DeviceClass } from "@/types/device";

interface RoadmapModalProps {
  isOpen: boolean;
  onClose: () => void;
  deviceClass?: DeviceClass | string;
}

export function RoadmapModal({ isOpen, onClose, deviceClass = "iot-sensor" }: RoadmapModalProps) {
  const [requestedAccess, setRequestedAccess] = useState(false);

  if (!isOpen) return null;

  const isPLC = deviceClass === "plc-controller";
  const title = isPLC ? "Industrial PLC Telemetry Roadmap" : "IoT Edge Sensor Telemetry Roadmap";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 p-4 animate-fade-in">
      <div className="w-full max-w-lg rounded border border-border bg-panel p-6 space-y-5 animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded border border-amber/30 bg-amber/10 text-amber">
              {isPLC ? <Cpu className="h-5 w-5" /> : <Radio className="h-5 w-5" />}
            </div>
            <div>
              <h3 className="font-display text-base font-semibold text-text">
                {title}
              </h3>
              <span className="inline-flex items-center gap-1 font-mono text-[11px] text-amber font-semibold">
                <Clock className="h-3 w-3" /> Future Roadmap Phase 5 Goal
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-text-faint hover:text-text p-1 rounded cursor-pointer transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Details */}
        <div className="space-y-4 font-mono text-xs">
          <div className="rounded border border-amber/30 bg-amber/10 p-3.5 text-amber space-y-1.5 leading-relaxed">
            <div className="flex items-center gap-1.5 font-bold">
              <Zap className="h-4 w-4 shrink-0" />
              <span>Target Release: Q3 / Q4 2026 (Driver Engine v2.0)</span>
            </div>
            <p className="text-[11px] opacity-90">
              {isPLC
                ? "Industrial PLC telemetry requires hardware protocol bridge connectors for real-time register extraction and power footprint estimation."
                : "IoT Sensor telemetry requires lightweight edge mesh protocols for low-latency battery and solar carbon telemetry collection."}
            </p>
          </div>

          <div className="space-y-2">
            <p className="font-semibold text-text">
              Protocol Specifications under Development:
            </p>
            <div className="grid grid-cols-2 gap-2">
              {isPLC ? (
                <>
                  <div className="rounded bg-bg/60 p-2.5 border border-border space-y-1">
                    <span className="font-bold text-accent">Modbus TCP</span>
                    <p className="text-[10px] text-text-muted">Register Polling Engine</p>
                  </div>
                  <div className="rounded bg-bg/60 p-2.5 border border-border space-y-1">
                    <span className="font-bold text-accent">Siemens S7</span>
                    <p className="text-[10px] text-text-muted">Profinet Connector</p>
                  </div>
                  <div className="rounded bg-bg/60 p-2.5 border border-border space-y-1">
                    <span className="font-bold text-accent">OPC-UA Server</span>
                    <p className="text-[10px] text-text-muted">Secure Node Subscription</p>
                  </div>
                  <div className="rounded bg-bg/60 p-2.5 border border-border space-y-1">
                    <span className="font-bold text-accent">EtherNet/IP</span>
                    <p className="text-[10px] text-text-muted">Rockwell / Allen-Bradley</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded bg-bg/60 p-2.5 border border-border space-y-1">
                    <span className="font-bold text-accent">MQTT / MQTTS</span>
                    <p className="text-[10px] text-text-muted">Pub/Sub Carbon Stream</p>
                  </div>
                  <div className="rounded bg-bg/60 p-2.5 border border-border space-y-1">
                    <span className="font-bold text-accent">CoAP Protocol</span>
                    <p className="text-[10px] text-text-muted">Constrained Application</p>
                  </div>
                  <div className="rounded bg-bg/60 p-2.5 border border-border space-y-1">
                    <span className="font-bold text-accent">BLE Gateway</span>
                    <p className="text-[10px] text-text-muted">Bluetooth Low Energy</p>
                  </div>
                  <div className="rounded bg-bg/60 p-2.5 border border-border space-y-1">
                    <span className="font-bold text-accent">Zigbee Green</span>
                    <p className="text-[10px] text-text-muted">Energy Harvesting Node</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-border pt-4 font-mono text-xs">
          <div className="flex items-center gap-1.5 text-text-muted text-[11px]">
            <Shield className="h-3.5 w-3.5 text-accent" />
            <span>Phase 5 Roadmap</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded border border-border px-4 py-2 font-semibold text-text-muted hover:text-text cursor-pointer"
            >
              Close
            </button>
            <button
              onClick={() => setRequestedAccess(true)}
              disabled={requestedAccess}
              className={`flex items-center gap-1.5 rounded px-4 py-2 font-semibold transition-colors cursor-pointer ${
                requestedAccess
                  ? "bg-border/50 text-success border border-success/30 cursor-default"
                  : "bg-accent text-white hover:bg-accent-hover border border-accent"
              }`}
            >
              {requestedAccess ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Waitlist Joined</span>
                </>
              ) : (
                <>
                  <span>Join Early Access Waitlist</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
