"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export type RealtimeEvent =
  | { type: "telemetry"; payload: Record<string, unknown>; received_at: string }
  | { type: "fleet.update"; payload: Record<string, unknown>; received_at: string }
  | { type: "alert"; payload: Record<string, unknown>; received_at: string }
  | { type: "ping"; ts: number }
  | { type: string; [k: string]: unknown };

export interface UseRealtimeOptions {
  url?: string;
  autoConnect?: boolean;
  onEvent?: (event: RealtimeEvent) => void;
}

export interface UseRealtimeReturn {
  connected: boolean;
  lastEvent: RealtimeEvent | null;
  events: RealtimeEvent[];
  connect: () => void;
  disconnect: () => void;
}

const DEFAULT_WS_URL =
  (typeof window !== "undefined"
    ? `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws`
    : "ws://localhost/ws");

export function useRealtime(options: UseRealtimeOptions = {}): UseRealtimeReturn {
  const { url = DEFAULT_WS_URL, autoConnect = true, onEvent } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onEventRef = useRef(onEvent);
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);
  const [events, setEvents] = useState<RealtimeEvent[]>([]);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const clearReconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const scheduleReconnect = useCallback(() => {
    clearReconnect();
    reconnectTimerRef.current = setTimeout(() => {
      connectInternal();
    }, 3000);
  }, [clearReconnect]);

  const connectInternal = useCallback(() => {
    if (typeof window === "undefined") return;
    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) return;

    try {
      const socket = new WebSocket(url);
      wsRef.current = socket;

      socket.onopen = () => {
        setConnected(true);
      };
      socket.onmessage = (msg) => {
        try {
          const parsed = JSON.parse(msg.data) as RealtimeEvent;
          setLastEvent(parsed);
          setEvents((prev) => [...prev.slice(-99), parsed]);
          onEventRef.current?.(parsed);
        } catch {
          // ignore non-JSON frames
        }
      };
      socket.onerror = () => {
        setConnected(false);
      };
      socket.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        scheduleReconnect();
      };
    } catch {
      scheduleReconnect();
    }
  }, [url, scheduleReconnect]);

  const connect = useCallback(() => {
    clearReconnect();
    connectInternal();
  }, [clearReconnect, connectInternal]);

  const disconnect = useCallback(() => {
    clearReconnect();
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnected(false);
  }, [clearReconnect]);

  useEffect(() => {
    if (autoConnect) connectInternal();
    return () => {
      clearReconnect();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoConnect]);

  return { connected, lastEvent, events, connect, disconnect };
}
