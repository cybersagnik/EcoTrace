"use client";
import { useEffect, useState, useCallback } from "react";
import {
  getFleet,
  assignDeviceToFleet,
  unassignDeviceFromFleet,
} from "@/services/api/fleets";
import { FleetDetail } from "@/types/fleet";

export function useFleetDetail(fleetId: number | null, pollingIntervalMs: number = 30000) {
  const [fleet, setFleet] = useState<FleetDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchFleet = useCallback(() => {
    if (fleetId === null) return;
    setError(null);
    getFleet(fleetId)
      .then(setFleet)
      .catch((e) => setError(e.message ?? String(e)));
  }, [fleetId]);

  useEffect(() => {
    if (fleetId === null) {
      setFleet(null);
      return;
    }
    fetchFleet();
    const id = setInterval(fetchFleet, pollingIntervalMs);
    return () => clearInterval(id);
  }, [fetchFleet, pollingIntervalMs, fleetId]);

  const assign = useCallback(async (deviceId: string) => {
    if (fleetId === null) return;
    await assignDeviceToFleet(fleetId, deviceId);
    fetchFleet();
  }, [fleetId, fetchFleet]);

  const unassign = useCallback(async (deviceId: string) => {
    if (fleetId === null) return;
    await unassignDeviceFromFleet(fleetId, deviceId);
    fetchFleet();
  }, [fleetId, fetchFleet]);

  return {
    fleet,
    loading: fleetId !== null && !fleet && !error,
    error,
    refetch: fetchFleet,
    assign,
    unassign,
  };
}
