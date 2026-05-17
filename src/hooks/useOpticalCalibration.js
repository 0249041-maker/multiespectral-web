import { useCallback, useEffect, useState } from "react";
import { WAVELENGTH_FILTERS } from "@/lib/cameraDashboardConstants";
import { findFilterById } from "@/lib/cameraWsProtocol";
import { useCameraWebSocket } from "@/hooks/useCameraWebSocket";

const DEFAULT_EXPOSURE_MS = 30;

/**
 * Calibración óptica (enfoque/diafragma): start / set_exposure / move_filter / finish.
 * @param {{ wsUrl?: string, appendLog?: (line: string) => void, onSessionStart?: () => void, onSessionEnd?: () => void }} options
 */
export function useOpticalCalibration({
  wsUrl,
  appendLog,
  onSessionStart,
  onSessionEnd,
} = {}) {
  const [exposureMs, setExposureMs] = useState(String(DEFAULT_EXPOSURE_MS));
  const [sessionActive, setSessionActive] = useState(false);
  const [selectedFilterId, setSelectedFilterId] = useState(
    WAVELENGTH_FILTERS[2]?.id ?? 3
  );

  const handleCommandDone = useCallback(
    ({ command, success }) => {
      if (command === "start_optical_calibration" && success) {
        setSessionActive(true);
        onSessionStart?.();
      }
      if (command === "finish_optical_calibration" && success) {
        setSessionActive(false);
        onSessionEnd?.();
      }
      if (command === "move_filter" && success) {
        // filter position updated via status / result
      }
    },
    [onSessionStart, onSessionEnd]
  );

  const ws = useCameraWebSocket({
    wsUrl,
    appendLog,
    onCommandDone: handleCommandDone,
  });

  const controlsDisabled = ws.commandPending;

  const parseExposure = useCallback(() => {
    const n = Number.parseFloat(exposureMs);
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_EXPOSURE_MS;
  }, [exposureMs]);

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
