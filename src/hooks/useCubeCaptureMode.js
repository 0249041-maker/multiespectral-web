import { useCallback, useEffect, useRef, useState } from "react";
import { WAVELENGTH_FILTERS } from "@/lib/cameraDashboardConstants";
import {
  CUBE_CAPTURE_LEAVE_DEFER_MS,
  canRequestCubeCaptureFinish,
  canRequestCubeCaptureStart,
  cubeCaptureSession,
  markCubeCaptureFinishSent,
  markCubeCaptureModeActive,
  markCubeCaptureStartFailed,
  markCubeCaptureStartRequested,
  resetCubeCaptureSessionAfterFinish,
} from "@/lib/cubeCaptureSessionState";
import {
  buildCaptureCubePayload,
  createCaptureCubeCommandId,
  createFinishCubeModeCommandId,
  createStartCubeModeCommandId,
  findFilterById,
} from "@/lib/cameraWsProtocol";
import {
  useCameraCommandListener,
  useCameraWs,
} from "@/context/CameraWebSocketContext";

const DEFAULT_EXPOSURE_MS = 30;

/**
 * Modo captura de cubo: un start al entrar al apartado, finish solo al salir (defer StrictMode).
 */
export function useCubeCaptureMode({
  appendLog,
  activeWhiteReference,
  opticalExposureMs,
  onCaptureSuccess,
} = {}) {
  const initialExp =
    opticalExposureMs ?? activeWhiteReference?.exposure_ms ?? DEFAULT_EXPOSURE_MS;

  const [exposureMs, setExposureMs] = useState(String(initialExp));
  const [modeActive, setModeActive] = useState(cubeCaptureSession.modeActive);
  const [lastCaptureOk, setLastCaptureOk] = useState(false);
  const [selectedFilterId, setSelectedFilterId] = useState(
    WAVELENGTH_FILTERS[2]?.id ?? 3
  );

  const ws = useCameraWs();
  const onCaptureSuccessRef = useRef(onCaptureSuccess);
  const appendLogRef = useRef(appendLog);
  const wsApiRef = useRef(ws);

  wsApiRef.current = ws;
  appendLogRef.current = appendLog;

  useEffect(() => {
    onCaptureSuccessRef.current = onCaptureSuccess;
  }, [onCaptureSuccess]);

  const parseExposure = useCallback(() => {
    const n = Number.parseFloat(exposureMs);
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_EXPOSURE_MS;
  }, [exposureMs]);

  const tryStartOnce = useCallback(() => {
    if (!canRequestCubeCaptureStart()) return false;
    const api = wsApiRef.current;
    if (!api?.connected || api.commandPending) return false;

    markCubeCaptureStartRequested();
    const ok = api.sendCommand(
      "start_cube_capture_mode",
      {},
      createStartCubeModeCommandId()
    );
    if (ok) {
      appendLogRef.current?.("[CAPTURE] → start_cube_capture_mode");
    } else {
      markCubeCaptureStartFailed();
    }
    return ok;
  }, []);

  const tryFinishOnce = useCallback((reason = "salida") => {
    if (!canRequestCubeCaptureFinish()) return false;
    const api = wsApiRef.current;
    if (!api) return false;

    markCubeCaptureFinishSent();
    const ok = api.sendCommand(
      "finish_cube_capture_mode",
      {},
      createFinishCubeModeCommandId()
    );
    if (ok) {
      appendLogRef.current?.(`[CAPTURE] → finish_cube_capture_mode (${reason})`);
    } else {
      cubeCaptureSession.finishSent = false;
    }
    return ok;
  }, []);

  useCameraCommandListener(
    useCallback(({ command, success }) => {
      if (command === "start_cube_capture_mode") {
        if (success) {
          markCubeCaptureModeActive();
          setModeActive(true);
          wsApiRef.current?.setLiveViewSuppressed(false);
          appendLogRef.current?.("[OK] Modo captura de cubo activo");
        } else {
          markCubeCaptureStartFailed();
          setModeActive(false);
          appendLogRef.current?.("[ERR] start_cube_capture_mode falló");
        }
      }
      if (command === "capture_cube") {
        setLastCaptureOk(success);
        if (success) {
          onCaptureSuccessRef.current?.();
        }
      }
      if (command === "finish_cube_capture_mode") {
        if (success) {
          resetCubeCaptureSessionAfterFinish();
          setModeActive(false);
          wsApiRef.current?.setLiveViewSuppressed(true);
          appendLogRef.current?.("[OK] Modo captura finalizado");
        } else {
          cubeCaptureSession.finishSent = false;
        }
      }
    }, [])
  );

  useEffect(() => {
    cubeCaptureSession.mountCount += 1;
    tryStartOnce();

    return () => {
      cubeCaptureSession.mountCount -= 1;

      window.setTimeout(() => {
        if (cubeCaptureSession.mountCount > 0) return;
        tryFinishOnce("cambio de apartado");
      }, CUBE_CAPTURE_LEAVE_DEFER_MS);
    };
  }, [tryStartOnce, tryFinishOnce]);

  useEffect(() => {
    if (cubeCaptureSession.mountCount > 0) {
      tryStartOnce();
    }
  }, [ws.connected, ws.commandPending, tryStartOnce]);

  useEffect(() => {
    setModeActive(cubeCaptureSession.modeActive);
  }, [ws.connected]);

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
        appendLogRef.current?.("[ERR] Falta calibración de blancos activa.");
        return false;
      }
      const trimmed = name?.trim();
      if (!trimmed) {
        appendLogRef.current?.("[ERR] Indica un nombre de captura.");
        return false;
      }

      const payload = buildCaptureCubePayload(trimmed, parseExposure(), {
        cube_id: activeWhiteReference.cube_id,
        compensators: activeWhiteReference.compensators,
      });

      setLastCaptureOk(false);
      return ws.sendCommand("capture_cube", payload, createCaptureCubeCommandId());
    },
    [activeWhiteReference, parseExposure, ws]
  );

  const exitCaptureMode = useCallback(() => {
    tryFinishOnce("botón salir");
  }, [tryFinishOnce]);

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
  const isStarting =
    cubeCaptureSession.startRequested && !cubeCaptureSession.modeActive;

  return {
    ...ws,
    exposureMs,
    setExposureMs,
    modeActive,
    isStarting,
    lastCaptureOk,
    selectedFilterId,
    activeFilter,
    controlsDisabled,
    canCapture,
    applyExposure,
    moveFilter,
    captureCube,
    exitCaptureMode,
    liveViewReady: modeActive && Boolean(ws.frameUrl),
  };
}
