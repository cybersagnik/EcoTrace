"use client";

import { useState, useEffect } from "react";

export interface AlertItem {
  id: number;
  title: string;
  device: string;
  time: string;
  severity: "critical" | "warning" | "info";
  message: string;
  acknowledged: boolean;
}

const INITIAL_ALERTS: AlertItem[] = [
  {
    id: 1,
    title: "High Carbon Intensity Threshold Exceeded",
    device: "datacenter-eu-west-04",
    time: "10 mins ago",
    severity: "critical",
    message: "Grid intensity spiked to 480 gCO2e/kWh during peak hours. Automated load reduction triggered.",
    acknowledged: false,
  },
  {
    id: 2,
    title: "Telemetry Sensor Degraded Signal",
    device: "iot-gateway-ap-south",
    time: "45 mins ago",
    severity: "warning",
    message: "Packet drop rate exceeded 2.5% threshold. System operating on fallback polling rate.",
    acknowledged: false,
  },
  {
    id: 3,
    title: "Solar Battery Storage Fully Charged",
    device: "edge-us-east-01",
    time: "2 hours ago",
    severity: "info",
    message: "100% renewable power switched to primary supply for datacenter cluster.",
    acknowledged: true,
  },
];

const STORAGE_KEY = "ecotrace_alerts_state";

export function useAlerts() {
  const [alerts, setAlerts] = useState<AlertItem[]>(INITIAL_ALERTS);

  // Read saved state safely in useEffect after initial hydration
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setAlerts(JSON.parse(saved));
      }
    } catch {
      // Fallback to initial alerts
    }
  }, []);

  // Write updated state to localStorage when alerts state changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
    } catch {
      // Ignore write errors
    }
  }, [alerts]);

  const toggleAcknowledge = (id: number) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, acknowledged: !a.acknowledged } : a))
    );
  };

  const unacknowledgedCount = alerts.filter((a) => !a.acknowledged).length;

  return { alerts, toggleAcknowledge, unacknowledgedCount };
}
