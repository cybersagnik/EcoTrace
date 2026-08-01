"use client";
import { useEffect, useState, useCallback } from "react";
import { getDevices } from "@/services/api/devices";
import { Device } from "@/types/device";

export function useDevices(pollingIntervalMs: number = 30000) {
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchDevices = useCallback(() => {
    getDevices()
      .then(setDevices)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    fetchDevices();
    const intervalId = setInterval(fetchDevices, pollingIntervalMs);
    return () => clearInterval(intervalId);
  }, [fetchDevices, pollingIntervalMs]);

  return { devices, loading: !devices && !error, error, refetch: fetchDevices };
}
