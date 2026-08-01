"use client";

import { useEffect, useState, useCallback } from "react";
import { getRecommendations, RecommendationResponse } from "@/services/api/recommendation";

export function useRecommendation(pollingIntervalMs: number = 30000) {
  const [data, setData] = useState<RecommendationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchReco = useCallback(() => {
    getRecommendations()
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    fetchReco();
    const intervalId = setInterval(fetchReco, pollingIntervalMs);
    return () => clearInterval(intervalId);
  }, [fetchReco, pollingIntervalMs]);

  return { data, loading: !data && !error, error, refetch: fetchReco };
}
