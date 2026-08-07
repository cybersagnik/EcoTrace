"use client";

import { useState, useEffect, useCallback } from "react";
import { getAlerts, AlertItem } from "@/services/api/alerts";

export type { AlertItem } from "@/services/api/alerts";

const POLLING_INTERVAL_MS = 30000;
const ACK_STORAGE_KEY = "ecotrace_alerts_acknowledged";

function readAcknowledgedIds(): string[] {
  try {
    const raw = localStorage.getItem(ACK_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function useAlerts() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [acknowledgedIds, setAcknowledgedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Load acknowledged ids after hydration
  useEffect(() => {
    setAcknowledgedIds(readAcknowledgedIds());
  }, []);

  // Persist acknowledged ids
  useEffect(() => {
    try {
      localStorage.setItem(ACK_STORAGE_KEY, JSON.stringify(acknowledgedIds));
    } catch {
      // Ignore write errors
    }
  }, [acknowledgedIds]);

  const fetchAlerts = useCallback(() => {
    setError(null);
    getAlerts()
      .then((res) => {
        const ack = new Set(acknowledgedIds);
        setAlerts(res.alerts.map((a) => ({ ...a, acknowledged: ack.has(a.id) })));
      })
      .catch((e) => setError(e.message ?? String(e)));
  }, [acknowledgedIds]);

  useEffect(() => {
    fetchAlerts();
    const intervalId = setInterval(fetchAlerts, POLLING_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [fetchAlerts]);

  const toggleAcknowledge = useCallback((id: string) => {
    setAcknowledgedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const unacknowledgedCount = alerts.filter((a) => !a.acknowledged).length;

  return { alerts, toggleAcknowledge, unacknowledgedCount, error, refetch: fetchAlerts };
}
