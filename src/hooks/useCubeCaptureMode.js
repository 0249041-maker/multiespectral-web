import { useCallback, useEffect, useRef, useState } from "react";
import { WAVELENGTH_FILTERS } from "@/lib/cameraDashboardConstants";
import {
  buildCaptureCubePayload,
  createCaptureCubeCommandId,
  createFinishCubeModeCommandId,
  createStartCubeModeCommandId,
  findFilterById,
} from "@/lib/cameraWsProtocol";
import { useCameraWebSocket } from "@/hooks/useCameraWebSocket";

const DEFAULT_EXPOSURE_MS = 30;

/**
 * Modo captura de cubo: start_cube_capture_mode al montar, finish al desmontar,
 * live view + move_filter / set_exposure / capture_cube.
 * @param {{
 *   wsUrl?: string,
 *   appendLog?: (line: string) => void,
 *   activeWhiteReference?: { cube_id: string, compensators: Record<string, number>, exposure_ms?: number } | null,
 *   opticalExposureMs?: number | null,
 *   onCaptureSuccess?: () => void,
 * }} options
 */
export function useCubeCaptureMode({
  wsUrl,
  appendLog,
  activeWhiteReference,
  opticalExposureMs,
  onCaptureSuccess,
} = {}) {
  const initialExp =
    opticalExposureMs ?? activeWhiteReference?.exposure_ms ?? DEFAULT_EXPOSURE_MS;

  const [exposureMs, setExposureMs] = useState(String(initialExp));
  const [modeActive, setModeActive] = useState(false);
  const [lastCaptureOk, setLastCaptureOk] = useState(false);
  const [selectedFilterId, setSelectedFilterId] = useState(
    WAVELENGTH_FILTERS[2]?.id ?? 3
  );

  const onCaptureSuccessRef = useRef(onCaptureSuccess);
  const wsApiRef = useRef(null);
  const modeStartRequestedRef = useRef(false);
  const modeStartedRef = useRef(false);
  const modeFinishSentRef = useRef(false);

  useEffect(() => {
    onCaptureSuccessRef.current = onCaptureSuccess;
  }, [onCaptureSuccess]);

  const parseExposure = useCallback(() => {
    const n = Number.parseFloat(exposureMs);
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_EXPOSURE_MS;
  }, [exposureMs]);

  const ws = useCameraWebSocket({
    wsUrl,
    appendLog,
    onCommandDone: ({ command, success }) => {
      if (command === "start_cube_capture_mode") {
        if (success) {
          modeStartedRef.current = true;
          setModeActive(true);
          wsApiRef.current?.setLiveViewSuppressed(false);
        } else {
          modeStartRequestedRef.current = false;
        }
      }
      if (command === "set_exposure" && success) {
        appendLog?.(`[CAPTURE] Exposición · ${parseExposure()} ms`);
      }
      if (command === "capture_cube") {
        setLastCaptureOk(success);
        if (success) {
          onCaptureSuccessRef.current?.();
        }
      }
      if (command === "finish_cube_capture_mode" && success) {
        setModeActive(false);
        wsApiRef.current?.setLiveViewSuppressed(true);
      }
    },
  });

  wsApiRef.current = ws;

  const requestStartMode = useCallback(() => {
    if (modeStartRequestedRef.current || modeStartedRef.current) return;
    modeStartRequestedRef.current = true;
    ws.sendCommand(
      "start_cube_capture_mode",
      {},
      createStartCubeModeCommandId()
    );
  }, [ws]);

  const requestFinishMode = useCallback(() => {
    if (modeFinishSentRef.current) return;
    modeFinishSentRef.current = true;
    ws.sendCommand(
      "finish_cube_capture_mode",
      {},
      createFinishCubeModeCommandId()
    );
  }, [ws]);

  useEffect(() => {
    if (ws.connected) {
      requestStartMode();
    }
  }, [ws.connected, requestStartMode]);

  useEffect(() => {
    return () => {
      if (modeStartedRef.current) {
        requestFinishMode();
      }
    };
  }, [requestFinishMode]);

  const applyExposure = useCallback(() => {
    ws.sendCommand("set_exposure", { exposure_ms: parseExposure() });
  }, [ws, parseExposure]);

  const moveFilter = useCallback(
    (filterId) => {
      const filter = findFilterById(filterId);
      if (!filter) return;
      setSelectedFilterId(filter.id);
      ws.sendCommand("move_filter", { filter_id: filter.id });
    },
    [ws]
  );

  const captureCube = useCallback(
    (name) => {
      if (!activeWhiteReference?.compensators) {
        appendLog?.("[ERR] Falta calibración de blancos activa.");
        return false;
      }
      const trimmed = name?.trim();
      if (!trimmed) {
        appendLog?.("[ERR] Indica un nombre de captura.");
        return false;
      }

      const payload = buildCaptureCubePayload(trimmed, parseExposure(), {
        cube_id: activeWhiteReference.cube_id,
        compensators: activeWhiteReference.compensators,
      });

      setLastCaptureOk(false);
      return ws.sendCommand("capture_cube", payload, createCaptureCubeCommandId());
    },
    [activeWhiteReference, parseExposure, ws, appendLog]
  );

  useEffect(() => {
    if (ws.cameraInfo?.current_filter_id != null) {
      setSelectedFilterId(ws.cameraInfo.current_filter_id);
    }
  }, [ws.cameraInfo?.current_filter_id]);

  const activeFilter =
    findFilterById(ws.cameraInfo?.current_filter_id ?? selectedFilterId) ??
    findFilterById(selectedFilterId) ??
    WAVELENGTH_FILTERS[0];

  const controlsDisabled = !modeActive || ws.commandPending;
  const canCapture = Boolean(modeActive && activeWhiteReference?.compensators);

  return {
    ...ws,
    exposureMs,
    setExposureMs,
    modeActive,
    lastCaptureOk,
    selectedFilterId,
    activeFilter,
    controlsDisabled,
    canCapture,
    applyExposure,
    moveFilter,
    captureCube,
    requestStartMode,
    liveViewReady: modeActive && Boolean(ws.frameUrl),
  };
}
