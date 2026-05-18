import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { useCameraWebSocket } from "@/hooks/useCameraWebSocket";
import { CAMERA_LIVE_WS_URL } from "@/lib/cameraDashboardConstants";

const CameraWebSocketContext = createContext(null);

/**
 * Una sola conexión WebSocket para todo el panel de cámara.
 * Evita conectar/desconectar al cambiar de pestaña (calibración ↔ captura).
 */
export function CameraWebSocketProvider({
  children,
  wsUrl = CAMERA_LIVE_WS_URL,
  appendLog,
}) {
  const listenersRef = useRef(new Set());
  const eventListenersRef = useRef(new Set());

  const notifyCommandDone = useCallback((info) => {
    for (const fn of listenersRef.current) {
      try {
        fn(info);
      } catch (e) {
        console.error("[CameraWebSocket] command listener error:", e);
      }
    }
  }, []);

  const notifyCommandEvent = useCallback((info) => {
    for (const fn of eventListenersRef.current) {
      try {
        fn(info);
      } catch (e) {
        console.error("[CameraWebSocket] command event listener error:", e);
      }
    }
  }, []);

  const ws = useCameraWebSocket({
    wsUrl,
    appendLog,
    onCommandDone: notifyCommandDone,
    onCommandEvent: notifyCommandEvent,
  });

  const subscribeCommandDone = useCallback((fn) => {
    listenersRef.current.add(fn);
    return () => listenersRef.current.delete(fn);
  }, []);

  const subscribeCommandEvent = useCallback((fn) => {
    eventListenersRef.current.add(fn);
    return () => eventListenersRef.current.delete(fn);
  }, []);

  const value = useMemo(
    () => ({
      ...ws,
      subscribeCommandDone,
      subscribeCommandEvent,
    }),
    [ws, subscribeCommandDone, subscribeCommandEvent]
  );

  return (
    <CameraWebSocketContext.Provider value={value}>
      {children}
    </CameraWebSocketContext.Provider>
  );
}

export function useCameraWs() {
  const ctx = useContext(CameraWebSocketContext);
  if (!ctx) {
    throw new Error("useCameraWs debe usarse dentro de CameraWebSocketProvider");
  }
  return ctx;
}

/**
 * Escucha command_done sin abrir otro WebSocket.
 * @param {(info: { command: string, success: boolean, result?: unknown, error?: unknown }) => void} listener
 */
export function useCameraCommandListener(listener) {
  const { subscribeCommandDone } = useCameraWs();
  const listenerRef = useRef(listener);
  listenerRef.current = listener;

  useEffect(() => {
    if (!listener) return undefined;
    return subscribeCommandDone((info) => listenerRef.current?.(info));
  }, [subscribeCommandDone, listener]);
}

/**
 * Escucha ack, progress y done del comando activo.
 * @param {(info: import("@/hooks/useCameraWebSocket").CameraCommandEvent) => void} listener
 */
export function useCameraCommandEventListener(listener) {
  const { subscribeCommandEvent } = useCameraWs();
  const listenerRef = useRef(listener);
  listenerRef.current = listener;

  useEffect(() => {
    if (!listener) return undefined;
    return subscribeCommandEvent((info) => listenerRef.current?.(info));
  }, [subscribeCommandEvent, listener]);
}
