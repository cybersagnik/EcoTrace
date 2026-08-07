"use client";

import { useEffect, useState, useCallback } from "react";
import { getAnalytics, AnalyticsResponse } from "@/services/api/analytics";

export function useAnalytics(pollingIntervalMs: number = 30000) {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(() => {
    getAnalytics()
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    fetchAnalytics();
    const intervalId = setInterval(fetchAnalytics, pollingIntervalMs);
    return () => clearInterval(intervalId);
  }, [fetchAnalytics, pollingIntervalMs]);

  return { data, loading: !data && !error, error, refetch: fetchAnalytics };
}
