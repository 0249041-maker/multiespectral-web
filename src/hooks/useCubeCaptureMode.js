import { useCallback, useEffect, useRef, useState } from "react";
import { WAVELENGTH_FILTERS } from "@/lib/cameraDashboardConstants";
import {
  CUBE_CAPTURE_LEAVE_DEFER_MS,
  applyCubeCaptureModeFromCameraStatus,
  canRequestCubeCaptureFinish,
  canRequestCubeCaptureStart,
  cubeCaptureSession,
  isCameraInCubeCaptureMode,
  markCubeCaptureFinishSent,
  markCubeCaptureStartAcknowledged,
  markCubeCaptureStartFailed,
  markCubeCaptureStartRequested,
  resetCubeCaptureSessionAfterFinish,
  setCubeCaptureCameraState,
} from "@/lib/cubeCaptureSessionState";
import {
  buildCaptureCubePayload,
  createCaptureCubeCommandId,
  createFinishCubeModeCommandId,
  createStartCubeModeCommandId,
  findFilterById,
  isCubeCaptureCameraState,
} from "@/lib/cameraWsProtocol";
import {
  useCameraCommandListener,
  useCameraWs,
} from "@/context/CameraWebSocketContext";

const DEFAULT_EXPOSURE_MS = 30;

/**
 * Modo captura: start/finish según state de la cámara (status/hello), no solo flags locales.
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
  const [modeActive, setModeActive] = useState(false);
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

  const readCameraState = useCallback(() => {
    const state = wsApiRef.current?.cameraInfo?.state ?? "";
    setCubeCaptureCameraState(state);
    return state;
  }, []);

  const syncModeFromCamera = useCallback(
    (reason = "sync") => {
      const api = wsApiRef.current;
      if (!api || cubeCaptureSession.mountCount <= 0) return;

      const cameraState = readCameraState();
      const inCubeMode = isCubeCaptureCameraState(cameraState);

      if (inCubeMode) {
        applyCubeCaptureModeFromCameraStatus();
        setModeActive(true);
        api.setLiveViewSuppressed(false);
        if (reason !== "status") {
          appendLogRef.current?.(
            `[CAPTURE] Cámara ya en ${cameraState} · sin reenviar start`
          );
        }
        return;
      }

      setModeActive(false);

      if (canRequestCubeCaptureStart(cameraState) && api.connected && !api.commandPending) {
        markCubeCaptureStartRequested();
        const ok = api.sendCommand(
          "start_cube_capture_mode",
          {},
          createStartCubeModeCommandId()
        );
        if (ok) {
          appendLogRef.current?.(`[CAPTURE] → start_cube_capture_mode (${reason})`);
        } else {
          markCubeCaptureStartFailed();
        }
      }
    },
    [readCameraState]
  );

  const tryFinishOnce = useCallback((reason = "salida") => {
    const api = wsApiRef.current;
    if (!api) return false;

    const cameraState = readCameraState();
    if (!canRequestCubeCaptureFinish(cameraState)) {
      appendLogRef.current?.(
        `[CAPTURE] Sin finish (${reason}) · state=${cameraState || "—"}`
      );
      resetCubeCaptureSessionAfterFinish();
      setModeActive(false);
      return false;
    }

    markCubeCaptureFinishSent();
    const ok = api.sendCommand(
      "finish_cube_capture_mode",
      {},
      createFinishCubeModeCommandId()
    );
    if (ok) {
      appendLogRef.current?.(
        `[CAPTURE] → finish_cube_capture_mode (${reason}) · state=${cameraState}`
      );
    } else {
      cubeCaptureSession.finishSent = false;
    }
    return ok;
  }, [readCameraState]);

  useCameraCommandListener(
    useCallback(({ command, success }) => {
      if (command === "start_cube_capture_mode") {
        if (success) {
          markCubeCaptureStartAcknowledged();
          readCameraState();
          if (isCameraInCubeCaptureMode()) {
            setModeActive(true);
            wsApiRef.current?.setLiveViewSuppressed(false);
          }
          appendLogRef.current?.("[OK] start_cube_capture_mode · command_done");
        } else {
          markCubeCaptureStartFailed();
          setModeActive(isCameraInCubeCaptureMode());
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
          readCameraState();
          setModeActive(isCameraInCubeCaptureMode());
          if (!isCameraInCubeCaptureMode()) {
            wsApiRef.current?.setLiveViewSuppressed(true);
          }
          appendLogRef.current?.("[OK] finish_cube_capture_mode · command_done");
        } else {
          cubeCaptureSession.finishSent = false;
        }
      }
    }, [readCameraState])
  );

  useEffect(() => {
    cubeCaptureSession.mountCount += 1;
    syncModeFromCamera("entrada");

    return () => {
      cubeCaptureSession.mountCount -= 1;

      window.setTimeout(() => {
        if (cubeCaptureSession.mountCount > 0) return;
        tryFinishOnce("cambio de apartado");
      }, CUBE_CAPTURE_LEAVE_DEFER_MS);
    };
  }, [syncModeFromCamera, tryFinishOnce]);

  useEffect(() => {
    if (cubeCaptureSession.mountCount <= 0) return;
    readCameraState();
    setModeActive(isCameraInCubeCaptureMode());
    syncModeFromCamera("status");
  }, [ws.cameraInfo?.state, ws.connected, ws.commandPending, readCameraState, syncModeFromCamera]);

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

  const cameraState = ws.cameraInfo?.state ?? cubeCaptureSession.lastCameraState;
  const modeActiveFromCamera = isCubeCaptureCameraState(cameraState);
  const controlsDisabled = !modeActiveFromCamera || ws.commandPending;
  const canCapture = Boolean(modeActiveFromCamera && activeWhiteReference?.compensators);
  const isStarting =
    cubeCaptureSession.startRequested && !modeActiveFromCamera;

  return {
    ...ws,
    exposureMs,
    setExposureMs,
    modeActive: modeActiveFromCamera,
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
    liveViewReady: modeActiveFromCamera && Boolean(ws.frameUrl),
  };
}
