"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { ClientMessage, ServerMessage } from "@corpcraft/contracts";
import { useSwarmStore } from "./useSwarmStore";

// ──────────────────────────────────────────────
// useWebSocket — Persistent WS connection with auto-reconnect
// ──────────────────────────────────────────────

const INITIAL_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;

export function useWebSocket(url: string) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const backoffRef = useRef(INITIAL_BACKOFF_MS);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const handleServerMessage = useSwarmStore((s) => s.handleServerMessage);
  const setWsConnected = useSwarmStore((s) => s.setWsConnected);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    // Clean up previous connection
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onclose = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      if (
        wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING
      ) {
        wsRef.current.close();
      }
    }

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        backoffRef.current = INITIAL_BACKOFF_MS;
        setConnected(true);
        setWsConnected(true);
      };

      ws.onmessage = (ev) => {
        if (!mountedRef.current) return;
        try {
          const msg: ServerMessage = JSON.parse(ev.data as string);
          handleServerMessage(msg);
        } catch {
          console.warn("[WS] Failed to parse message:", ev.data);
        }
      };

      ws.onerror = () => {
        // Will trigger onclose — handled there
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setConnected(false);
        setWsConnected(false);

        // Schedule reconnect with exponential backoff
        const delay = backoffRef.current;
        backoffRef.current = Math.min(delay * 2, MAX_BACKOFF_MS);
        reconnectTimerRef.current = setTimeout(connect, delay);
      };
    } catch {
      // Schedule reconnect on construction error
      const delay = backoffRef.current;
      backoffRef.current = Math.min(delay * 2, MAX_BACKOFF_MS);
      reconnectTimerRef.current = setTimeout(connect, delay);
    }
  }, [url, handleServerMessage, setWsConnected]);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.onopen = null;
        wsRef.current.onclose = null;
        wsRef.current.onmessage = null;
        wsRef.current.onerror = null;
        wsRef.current.close();
      }
    };
  }, [connect]);

  const send = useCallback((msg: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    } else {
      console.warn("[WS] Cannot send — not connected");
    }
  }, []);

  return { connected, send } as const;
}
