"use client";
import { useEffect, useState, useCallback } from "react";
import { getFleetSummary, FleetResponse } from "@/services/api/fleet";

export function useFleet(pollingIntervalMs: number = 30000) {
  const [fleet, setFleet] = useState<FleetResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchFleet = useCallback(() => {
    getFleetSummary()
      .then(setFleet)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    fetchFleet();
    const intervalId = setInterval(fetchFleet, pollingIntervalMs);
    return () => clearInterval(intervalId);
  }, [fetchFleet, pollingIntervalMs]);

  return { fleet, loading: !fleet && !error, error, refetch: fetchFleet };
}
