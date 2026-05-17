import { useCallback, useEffect, useRef, useState } from "react";
import { WAVELENGTH_FILTERS } from "@/lib/cameraDashboardConstants";
import { findFilterById } from "@/lib/cameraWsProtocol";
import {
  useCameraCommandListener,
  useCameraWs,
} from "@/context/CameraWebSocketContext";

const DEFAULT_EXPOSURE_MS = 30;

/**
 * Calibración óptica (enfoque/diafragma): start / set_exposure / move_filter / finish.
 */
export function useOpticalCalibration({
  appendLog,
  onSessionStart,
  onSessionEnd,
  onExposureChange,
} = {}) {
  const [exposureMs, setExposureMs] = useState(String(DEFAULT_EXPOSURE_MS));
  const [sessionActive, setSessionActive] = useState(false);
  const [selectedFilterId, setSelectedFilterId] = useState(
    WAVELENGTH_FILTERS[2]?.id ?? 3
  );

  const ws = useCameraWs();
  const onSessionStartRef = useRef(onSessionStart);
  const onSessionEndRef = useRef(onSessionEnd);
  const onExposureChangeRef = useRef(onExposureChange);
  const sessionActiveRef = useRef(false);
  const wsApiRef = useRef(ws);

  wsApiRef.current = ws;
  sessionActiveRef.current = sessionActive;

  const parseExposure = useCallback(() => {
    const n = Number.parseFloat(exposureMs);
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_EXPOSURE_MS;
  }, [exposureMs]);

  useEffect(() => {
    onSessionStartRef.current = onSessionStart;
    onSessionEndRef.current = onSessionEnd;
    onExposureChangeRef.current = onExposureChange;
  }, [onSessionStart, onSessionEnd, onExposureChange]);

  useCameraCommandListener(
    useCallback(
      ({ command, success }) => {
        if (command === "start_optical_calibration" && success) {
          setSessionActive(true);
          wsApiRef.current?.setLiveViewSuppressed(false);
          onExposureChangeRef.current?.(parseExposure());
          onSessionStartRef.current?.();
        }
        if (command === "set_exposure" && success) {
          onExposureChangeRef.current?.(parseExposure());
        }
        if (command === "finish_optical_calibration" && success) {
          setSessionActive(false);
          wsApiRef.current?.setLiveViewSuppressed(true);
          onExposureChangeRef.current?.(parseExposure());
          onSessionEndRef.current?.();
        }
      },
      [parseExposure]
    )
  );

  useEffect(() => {
    return () => {
      if (sessionActiveRef.current) {
        wsApiRef.current?.sendCommand("finish_optical_calibration", {});
        appendLog?.("[CAL] Salida de pestaña · finish_optical_calibration");
      }
    };
  }, [appendLog]);

  const controlsDisabled = ws.commandPending;

  const startOpticalCalibration = useCallback(() => {
    ws.sendCommand("start_optical_calibration", {
      exposure_ms: parseExposure(),
    });
  }, [ws, parseExposure]);

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

  const finishOpticalCalibration = useCallback(() => {
    ws.sendCommand("finish_optical_calibration", {});
  }, [ws]);

  useEffect(() => {
    if (ws.cameraInfo?.current_filter_id != null) {
      setSelectedFilterId(ws.cameraInfo.current_filter_id);
    }
  }, [ws.cameraInfo?.current_filter_id]);

  const activeFilter =
    findFilterById(ws.cameraInfo?.current_filter_id ?? selectedFilterId) ??
    findFilterById(selectedFilterId) ??
    WAVELENGTH_FILTERS[0];

  return {
    ...ws,
    exposureMs,
    setExposureMs,
    sessionActive,
    selectedFilterId,
    activeFilter,
    controlsDisabled,
    startOpticalCalibration,
    applyExposure,
    moveFilter,
    finishOpticalCalibration,
    liveViewReady: sessionActive && Boolean(ws.frameUrl),
  };
}
