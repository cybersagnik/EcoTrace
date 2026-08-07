"use client";
import { useEffect, useState, useCallback } from "react";
import {
  getFleets,
  createFleet,
  deleteFleet,
} from "@/services/api/fleets";
import { Fleet, FleetCreateInput } from "@/types/fleet";

export function useFleets(pollingIntervalMs: number = 30000) {
  const [fleets, setFleets] = useState<Fleet[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchFleets = useCallback(() => {
    setError(null);
    getFleets()
      .then(setFleets)
      .catch((e) => setError(e.message ?? String(e)));
  }, []);

  useEffect(() => {
    fetchFleets();
    const id = setInterval(fetchFleets, pollingIntervalMs);
    return () => clearInterval(id);
  }, [fetchFleets, pollingIntervalMs]);

  const create = useCallback(async (input: FleetCreateInput): Promise<Fleet> => {
    const fleet = await createFleet(input);
    fetchFleets();
    return fleet;
  }, [fetchFleets]);

  const remove = useCallback(async (id: number) => {
    await deleteFleet(id);
    fetchFleets();
  }, [fetchFleets]);

  return {
    fleets,
    loading: !fleets && !error,
    error,
    refetch: fetchFleets,
    create,
    remove,
  };
}
