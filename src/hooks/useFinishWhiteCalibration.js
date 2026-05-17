import { useCallback, useEffect, useRef, useState } from "react";
import { formatCommandError } from "@/lib/cameraWsProtocol";
import {
  useCameraCommandListener,
  useCameraWs,
} from "@/context/CameraWebSocketContext";

/**
 * Envía finish_white_calibration tras tener compensadores activos en el front.
 */
export function useFinishWhiteCalibration({ appendLog, onFinished } = {}) {
  const ws = useCameraWs();
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;

  const [finalized, setFinalized] = useState(false);
  const [finishError, setFinishError] = useState("");

  useCameraCommandListener(
    useCallback(
      ({ command, success, error }) => {
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
      [appendLog]
    )
  );

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
