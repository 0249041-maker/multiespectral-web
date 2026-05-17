import { useCallback, useEffect, useRef, useState } from "react";
import { formatCommandError } from "@/lib/cameraWsProtocol";
import { useCameraWebSocket } from "@/hooks/useCameraWebSocket";

/**
 * Envía finish_white_calibration tras tener compensadores activos en el front.
 * @param {{ wsUrl?: string, appendLog?: (line: string) => void, onFinished?: () => void }} options
 */
export function useFinishWhiteCalibration({ wsUrl, appendLog, onFinished } = {}) {
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;

  const [finalized, setFinalized] = useState(false);
  const [finishError, setFinishError] = useState("");

  const ws = useCameraWebSocket({
    wsUrl,
    appendLog,
    onCommandDone: ({ command, success, error }) => {
      if (command !== "finish_white_calibration") return;

      if (success) {
        setFinishError("");
        setFinalized(true);
        onFinishedRef.current?.();
        appendLog?.("[OK] finish_white_calibration · cámara en línea");
      } else {
        const err = formatCommandError(error);
        setFinishError(err);
        setFinalized(false);
        appendLog?.(`[ERR] finish_white_calibration · ${err}`);
      }
    },
  });

  const finishWhiteCalibration = useCallback(() => {
    if (ws.commandPending || finalized) return false;
    setFinishError("");
    return ws.sendCommand("finish_white_calibration", {});
  }, [ws, finalized]);

  const resetForNewReference = useCallback(() => {
    setFinalized(false);
    setFinishError("");
  }, []);

  return {
    connected: ws.connected,
    connectionError: ws.connectionError,
    commandPending: ws.commandPending,
    statusText: ws.statusText,
    finishError,
    finalized,
    finishWhiteCalibration,
    resetForNewReference,
    reconnect: ws.reconnect,
  };
}

/**
 * Reinicia el estado de finalización si cambió el cubo blanco activo.
 * @param {ReturnType<typeof useFinishWhiteCalibration>} finish
 * @param {string | undefined} cubeId
 */
export function useResetFinishOnReferenceChange(finish, cubeId) {
  const prevIdRef = useRef(cubeId);

  useEffect(() => {
    if (!cubeId) return;
    if (prevIdRef.current && prevIdRef.current !== cubeId) {
      finish.resetForNewReference();
    }
    prevIdRef.current = cubeId;
  }, [cubeId, finish]);
}
