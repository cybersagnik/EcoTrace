"use client";
import { useState, useEffect, useCallback } from "react";
import {
  getDevices,
  getDeviceCategories,
  getDevicesByCategory,
} from "@/services/api/devices";
import {
  Device,
  DeviceCategory,
  DeviceCategoryCounts,
} from "@/types/device";

interface UseDevicesOptions {
  category?: DeviceCategory;
  pollingIntervalMs?: number;
}

export function useDevices(options: UseDevicesOptions | number = {}) {
  const normalized: UseDevicesOptions =
    typeof options === "number" ? { pollingIntervalMs: options } : options;
  const { category, pollingIntervalMs = 30000 } = normalized;

  const [devices, setDevices] = useState<Device[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchDevices = useCallback(() => {
    setError(null);
    const fetcher = category ? getDevicesByCategory(category) : getDevices();
    fetcher
      .then((rows) => {
        // Defensive category filter — if backend ever returns rows for
        // other categories, drop them here so the frontend can never
        // accidentally render an IoT/PLC row inside the Endpoints view.
        const filtered = category
          ? rows.filter((d) => !d.device_category || d.device_category === category)
          : rows;
        setDevices(filtered);
      })
      .catch((e) => setError(e.message ?? String(e)));
  }, [category]);

  useEffect(() => {
    fetchDevices();
    const intervalId = setInterval(fetchDevices, pollingIntervalMs);
    return () => clearInterval(intervalId);
  }, [fetchDevices, pollingIntervalMs]);

  return { devices, loading: !devices && !error, error, refetch: fetchDevices };
}

export function useDeviceCategories(pollingIntervalMs: number = 60000) {
  const [counts, setCounts] = useState<DeviceCategoryCounts | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchCounts = useCallback(() => {
    setError(null);
    getDeviceCategories()
      .then(setCounts)
      .catch((e) => setError(e.message ?? String(e)));
  }, []);

  useEffect(() => {
    fetchCounts();
    const intervalId = setInterval(fetchCounts, pollingIntervalMs);
    return () => clearInterval(intervalId);
  }, [fetchCounts, pollingIntervalMs]);

  return { counts, loading: !counts && !error, error, refetch: fetchCounts };
}
