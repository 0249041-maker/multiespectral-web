import { useCallback, useEffect, useRef, useState } from "react";
import { WAVELENGTH_FILTERS } from "@/lib/cameraDashboardConstants";
import { findFilterById } from "@/lib/cameraWsProtocol";
import { computeCompensatorsFromCaptureResult } from "@/lib/whiteCompensatorCompute";
import { useCameraWebSocket } from "@/hooks/useCameraWebSocket";

/**
 * Calibración de blancos por WebSocket (start_white_calibration, capture_white_reference, move_filter).
 * @param {{
 *   wsUrl?: string,
 *   appendLog?: (line: string) => void,
 *   opticalExposureMs?: number | null,
 *   onWhiteReferenceReady?: (ref: import("@/lib/whiteCompensatorCompute").WhiteReferenceState) => void,
 *   onSessionStart?: () => void,
 * }} options
 */
export function useWhiteCalibration({
  wsUrl,
  appendLog,
  opticalExposureMs,
  onWhiteReferenceReady,
  onSessionStart,
} = {}) {
  const [sessionActive, setSessionActive] = useState(false);
  const [liveViewEnded, setLiveViewEnded] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [selectedFilterId, setSelectedFilterId] = useState(
    WAVELENGTH_FILTERS[0]?.id ?? 1
  );
  const [captureName] = useState("white_reference");

  const onReadyRef = useRef(onWhiteReferenceReady);
  const onSessionStartRef = useRef(onSessionStart);

  useEffect(() => {
    onReadyRef.current = onWhiteReferenceReady;
    onSessionStartRef.current = onSessionStart;
  }, [onWhiteReferenceReady, onSessionStart]);

  const ws = useCameraWebSocket({
    wsUrl,
    appendLog,
    onCommandDone: async ({ command, success, result, error }) => {
      if (command === "start_white_calibration" && success) {
        setSessionActive(true);
        setLiveViewEnded(false);
        wsApiRef.current?.setLiveViewSuppressed(false);
        onSessionStartRef.current?.();
        return;
      }

      if (command === "capture_white_reference") {
        if (!success) {
          setProcessing(false);
          setLiveViewEnded(false);
          setSessionActive(true);
          wsApiRef.current?.setLiveViewSuppressed(false);
          return;
        }
        setProcessing(true);
        setSessionActive(false);
        wsApiRef.current?.setLiveViewSuppressed(true);
        try {
          const ref = await computeCompensatorsFromCaptureResult(
            /** @type {Record<string, unknown>} */ (result ?? {})
          );
          if (opticalExposureMs != null && ref.exposure_ms == null) {
            ref.exposure_ms = opticalExposureMs;
          }
          onReadyRef.current?.(ref);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Error al procesar cubo blanco";
          appendLog?.(`[ERR] ${msg}`);
          setLiveViewEnded(false);
          setSessionActive(true);
          wsApiRef.current?.setLiveViewSuppressed(false);
        } finally {
          setProcessing(false);
        }
      }

      if (error && command === "capture_white_reference") {
        setProcessing(false);
        setLiveViewEnded(false);
        setSessionActive(true);
        wsApiRef.current?.setLiveViewSuppressed(false);
      }
    },
  });

  const wsApiRef = useRef(null);
  wsApiRef.current = ws;

  const controlsDisabled = ws.commandPending || processing;

  const startWhiteCalibration = useCallback(() => {
    ws.sendCommand("start_white_calibration", {});
  }, [ws]);

  const captureWhiteReference = useCallback(() => {
    setLiveViewEnded(true);
    ws.setLiveViewSuppressed(true);
    ws.sendCommand("capture_white_reference", { name: captureName });
  }, [ws, captureName]);

  const moveFilter = useCallback(
    (filterId) => {
      const filter = findFilterById(filterId);
      if (!filter) return;
      setSelectedFilterId(filter.id);
      ws.sendCommand("move_filter", { filter_id: filter.id });
    },
    [ws]
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

  return {
    ...ws,
    sessionActive,
    processing,
    selectedFilterId,
    activeFilter,
    controlsDisabled,
    startWhiteCalibration,
    captureWhiteReference,
    moveFilter,
    hasOpticalExposure: opticalExposureMs != null && opticalExposureMs > 0,
    opticalExposureMs,
    liveViewEnded,
    liveViewReady: sessionActive && !liveViewEnded && Boolean(ws.frameUrl),
    showLiveView: sessionActive && !liveViewEnded,
  };
}
