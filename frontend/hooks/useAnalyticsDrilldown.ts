"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getAnalyticsFleets,
  getAnalyticsFleet,
  getAnalyticsDevice,
  AnalyticsFleetsResponse,
  AnalyticsFleetDetail,
  AnalyticsDeviceDetail,
} from "@/services/api/analytics";

export function useAnalyticsFleets(pollingIntervalMs: number = 30000) {
  const [data, setData] = useState<AnalyticsFleetsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchFleets = useCallback(() => {
    getAnalyticsFleets()
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    fetchFleets();
    const intervalId = setInterval(fetchFleets, pollingIntervalMs);
    return () => clearInterval(intervalId);
  }, [fetchFleets, pollingIntervalMs]);

  return { data, loading: !data && !error, error, refetch: fetchFleets };
}

export function useAnalyticsFleet(id: number | null, pollingIntervalMs: number = 60000) {
  const [data, setData] = useState<AnalyticsFleetDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchFleet = useCallback(() => {
    if (id == null) return;
    getAnalyticsFleet(id)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    fetchFleet();
    if (id == null) return;
    const intervalId = setInterval(fetchFleet, pollingIntervalMs);
    return () => clearInterval(intervalId);
  }, [fetchFleet, id, pollingIntervalMs]);

  return { data, loading: !data && !error, error, refetch: fetchFleet };
}

export function useAnalyticsDevice(id: string | null, pollingIntervalMs: number = 60000) {
  const [data, setData] = useState<AnalyticsDeviceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchDevice = useCallback(() => {
    if (!id) return;
    getAnalyticsDevice(id)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    fetchDevice();
    if (!id) return;
    const intervalId = setInterval(fetchDevice, pollingIntervalMs);
    return () => clearInterval(intervalId);
  }, [fetchDevice, id, pollingIntervalMs]);

  return { data, loading: !data && !error, error, refetch: fetchDevice };
}
