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

  const notifyCommandDone = useCallback((info) => {
    for (const fn of listenersRef.current) {
      try {
        fn(info);
      } catch (e) {
        console.error("[CameraWebSocket] command listener error:", e);
      }
    }
  }, []);

  const ws = useCameraWebSocket({
    wsUrl,
    appendLog,
    onCommandDone: notifyCommandDone,
  });

  const subscribeCommandDone = useCallback((fn) => {
    listenersRef.current.add(fn);
    return () => listenersRef.current.delete(fn);
  }, []);

  const value = useMemo(
    () => ({
      ...ws,
      subscribeCommandDone,
    }),
    [ws, subscribeCommandDone]
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
