"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { RealtimeEvent } from "@/hooks/useRealtime";

const DEFAULT_WS_URL =
  (typeof window !== "undefined"
    ? `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws`
    : "ws://localhost/ws");

export interface RealtimeClientOptions {
  url?: string;
  onEvent?: (event: RealtimeEvent) => void;
}

export interface RealtimeClient {
  connect: () => void;
  disconnect: () => void;
  isConnected: () => boolean;
}

export function createRealtimeClient(
  options: RealtimeClientOptions = {},
): RealtimeClient {
  const url = options.url || DEFAULT_WS_URL;
  const onEvent = options.onEvent;

  let socket: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let listeners: Array<(e: RealtimeEvent) => void> = onEvent ? [onEvent] : [];

  const emit = (event: RealtimeEvent) => {
    for (const l of listeners) {
      try {
        l(event);
      } catch {
        // swallow listener errors so one bad listener doesn't break the bus
      }
    }
  };

  const scheduleReconnect = () => {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => connect(), 3000);
  };

  const connect = () => {
    if (typeof window === "undefined") return;
    if (socket && socket.readyState !== WebSocket.CLOSED) return;
    try {
      socket = new WebSocket(url);
      socket.onmessage = (msg) => {
        try {
          const parsed = JSON.parse(msg.data) as RealtimeEvent;
          emit(parsed);
        } catch {
          // ignore non-JSON
        }
      };
      socket.onerror = () => scheduleReconnect();
      socket.onclose = () => {
        socket = null;
        scheduleReconnect();
      };
    } catch {
      scheduleReconnect();
    }
  };

  const disconnect = () => {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = null;
    if (socket) {
      socket.close();
      socket = null;
    }
  };

  return {
    connect,
    disconnect,
    isConnected: () => socket?.readyState === WebSocket.OPEN,
  };
}

export function useRealtimeBus(onEvent?: (e: RealtimeEvent) => void) {
  const clientRef = useRef<RealtimeClient | null>(null);
  const [connected, setConnected] = useState(false);

  const refreshConnection = useCallback(() => {
    const w = typeof window !== "undefined" ? window : null;
    if (!w) return;
    if (clientRef.current) clientRef.current.disconnect();
    clientRef.current = createRealtimeClient({
      onEvent: (e) => {
        onEvent?.(e);
      },
    });
    clientRef.current.connect();
    const interval = setInterval(() => {
      setConnected(clientRef.current?.isConnected() ?? false);
    }, 2000);
    return () => clearInterval(interval);
  }, [onEvent]);

  useEffect(() => {
    const cleanup = refreshConnection();
    return () => {
      cleanup?.();
      clientRef.current?.disconnect();
      clientRef.current = null;
    };
  }, [refreshConnection]);

  return { connected };
}
