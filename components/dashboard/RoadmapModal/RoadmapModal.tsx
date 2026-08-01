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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 dark:bg-black/85 backdrop-blur-md p-4 animate-fade-in">
      <div className="w-full max-w-lg rounded-[28px] border border-[#F59E0B]/40 bg-[#0F172A] dark:bg-[#0F172A] bg-white p-6 shadow-lg space-y-5 animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/50 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30">
              {isPLC ? <Cpu className="h-5 w-5" /> : <Radio className="h-5 w-5" />}
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-text dark:text-white text-slate-900">
                {title}
              </h3>
              <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[#F59E0B] font-semibold">
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
          <div className="rounded-[14px] border border-[#F59E0B]/25 bg-[#F59E0B]/10 p-3.5 text-[#F59E0B] space-y-1.5 leading-relaxed">
            <div className="flex items-center gap-1.5 font-bold">
              <Zap className="h-4 w-4 shrink-0 text-[#F59E0B]" />
              <span>Target Release: Q3 / Q4 2026 (Driver Engine v2.0)</span>
            </div>
            <p className="text-[11px] opacity-90">
              {isPLC
                ? "Industrial PLC telemetry requires hardware protocol bridge connectors for real-time register extraction and power footprint estimation."
                : "IoT Sensor telemetry requires lightweight edge mesh protocols for low-latency battery and solar carbon telemetry collection."}
            </p>
          </div>

          <div className="space-y-2">
            <p className="font-semibold text-text dark:text-slate-200 text-slate-800">
              Protocol Specifications under Development:
            </p>
            <div className="grid grid-cols-2 gap-2">
              {isPLC ? (
                <>
                  <div className="rounded-[14px] bg-bg/80 dark:bg-slate-950 p-2.5 border border-border/70 space-y-1">
                    <span className="font-bold text-[#16A34A]">Modbus TCP</span>
                    <p className="text-[10px] text-text-muted">Register Polling Engine</p>
                  </div>
                  <div className="rounded-[14px] bg-bg/80 dark:bg-slate-950 p-2.5 border border-border/70 space-y-1">
                    <span className="font-bold text-[#16A34A]">Siemens S7</span>
                    <p className="text-[10px] text-text-muted">Profinet Connector</p>
                  </div>
                  <div className="rounded-[14px] bg-bg/80 dark:bg-slate-950 p-2.5 border border-border/70 space-y-1">
                    <span className="font-bold text-[#16A34A]">OPC-UA Server</span>
                    <p className="text-[10px] text-text-muted">Secure Node Subscription</p>
                  </div>
                  <div className="rounded-[14px] bg-bg/80 dark:bg-slate-950 p-2.5 border border-border/70 space-y-1">
                    <span className="font-bold text-[#16A34A]">EtherNet/IP</span>
                    <p className="text-[10px] text-text-muted">Rockwell / Allen-Bradley</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-[14px] bg-bg/80 dark:bg-slate-950 p-2.5 border border-border/70 space-y-1">
                    <span className="font-bold text-[#16A34A]">MQTT / MQTTS</span>
                    <p className="text-[10px] text-text-muted">Pub/Sub Carbon Stream</p>
                  </div>
                  <div className="rounded-[14px] bg-bg/80 dark:bg-slate-950 p-2.5 border border-border/70 space-y-1">
                    <span className="font-bold text-[#16A34A]">CoAP Protocol</span>
                    <p className="text-[10px] text-text-muted">Constrained Application</p>
                  </div>
                  <div className="rounded-[14px] bg-bg/80 dark:bg-slate-950 p-2.5 border border-border/70 space-y-1">
                    <span className="font-bold text-[#16A34A]">BLE Gateway</span>
                    <p className="text-[10px] text-text-muted">Bluetooth Low Energy</p>
                  </div>
                  <div className="rounded-[14px] bg-bg/80 dark:bg-slate-950 p-2.5 border border-border/70 space-y-1">
                    <span className="font-bold text-[#16A34A]">Zigbee Green</span>
                    <p className="text-[10px] text-text-muted">Energy Harvesting Node</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-border/40 pt-4 font-mono text-xs">
          <div className="flex items-center gap-1.5 text-text-muted text-[11px]">
            <Shield className="h-3.5 w-3.5 text-[#16A34A]" />
            <span>Phase 5 Roadmap</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-[16px] border border-border px-4 py-2 font-semibold text-text-muted hover:text-text cursor-pointer"
            >
              Close
            </button>
            <button
              onClick={() => setRequestedAccess(true)}
              disabled={requestedAccess}
              className={`btn-primary flex items-center gap-1.5 rounded-[16px] px-4 py-2 font-semibold transition-all cursor-pointer ${
                requestedAccess
                  ? "bg-[#22C55E]/20 text-[#22C55E] border border-[#22C55E]/40 cursor-default hover:bg-[#22C55E]/20"
                  : "bg-[#16A34A] text-white hover:bg-[#15803D]"
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
