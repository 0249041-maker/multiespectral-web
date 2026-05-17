import { useCallback, useState } from "react";
import { buildCaptureCubePayload } from "@/lib/cameraWsProtocol";
import { useCameraWebSocket } from "@/hooks/useCameraWebSocket";

/**
 * Captura de cubo multiespectral con referencia blanca numérica en el payload.
 * @param {{
 *   wsUrl?: string,
 *   appendLog?: (line: string) => void,
 *   activeWhiteReference?: { cube_id: string, compensators: Record<string, number> } | null,
 *   opticalExposureMs?: number | null,
 *   onCaptureSuccess?: () => void,
 * }} options
 */
export function useCaptureCube({
  wsUrl,
  appendLog,
  activeWhiteReference,
  opticalExposureMs,
  onCaptureSuccess,
} = {}) {
  const [lastCaptureOk, setLastCaptureOk] = useState(false);

  const ws = useCameraWebSocket({
    wsUrl,
    appendLog,
    onCommandDone: ({ command, success }) => {
      if (command === "capture_cube") {
        setLastCaptureOk(success);
        if (success) onCaptureSuccess?.();
      }
    },
  });

  const captureCube = useCallback(
    (name, exposureMsOverride) => {
      if (!activeWhiteReference?.compensators) {
        appendLog?.("[ERR] Falta calibración de blancos activa.");
        return false;
      }
      const exposure_ms =
        exposureMsOverride ??
        opticalExposureMs ??
        activeWhiteReference.exposure_ms ??
        30;

      const payload = buildCaptureCubePayload(name, exposure_ms, {
        cube_id: activeWhiteReference.cube_id,
        compensators: activeWhiteReference.compensators,
      });

      setLastCaptureOk(false);
      return ws.sendCommand("capture_cube", payload);
    },
    [activeWhiteReference, opticalExposureMs, ws, appendLog]
  );

  return {
    ...ws,
    captureCube,
    lastCaptureOk,
    canCapture: Boolean(activeWhiteReference?.compensators),
  };
}
