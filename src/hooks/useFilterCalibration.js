import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildCalibrateFiltersCommand,
  createCommandId,
  formatCommandError,
  parseCameraJsonMessage,
  resolveCameraWsUrl,
} from "@/lib/cameraWsProtocol";

const STATUS = {
  IDLE: "idle",
  SENDING: "sending",
  ACCEPTED: "accepted",
  PROGRESS: "progress",
  SUCCESS: "success",
  ERROR: "error",
};

/**
 * WebSocket JSON command flow for filter wheel calibration.
 * @param {{ wsUrl?: string, appendLog?: (line: string) => void, onCalibrationSuccess?: () => void }} options
 */
export function useFilterCalibration({ wsUrl: fixedWsUrl, appendLog, onCalibrationSuccess } = {}) {
  const resolvedUrl = resolveCameraWsUrl(fixedWsUrl);

  const socketRef = useRef(null);
  const activeCommandIdRef = useRef(null);
  const pendingCalibrationRef = useRef(false);
  const unmountedRef = useRef(false);
  const appendLogRef = useRef(appendLog);
  const onSuccessRef = useRef(onCalibrationSuccess);

  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const [phase, setPhase] = useState(STATUS.IDLE);
  const [statusText, setStatusText] = useState("");
  const [cameraInfo, setCameraInfo] = useState(null);

  useEffect(() => {
    appendLogRef.current = appendLog;
  }, [appendLog]);

  useEffect(() => {
    onSuccessRef.current = onCalibrationSuccess;
  }, [onCalibrationSuccess]);

  const log = useCallback((line) => {
    appendLogRef.current?.(line);
  }, []);

  const finishCalibration = useCallback((nextPhase, message) => {
    activeCommandIdRef.current = null;
    pendingCalibrationRef.current = false;
    setPhase(nextPhase);
    if (message) setStatusText(message);
  }, []);

  const sendCalibrateFilters = useCallback(
    (socket, commandId) => {
      socket.send(JSON.stringify(buildCalibrateFiltersCommand(commandId)));
      setPhase(STATUS.SENDING);
      setStatusText("Sending calibration command...");
      log(`[WS] → calibrate_filters · ${commandId}`);
    },
    [log]
  );

  const handleCameraMessage = useCallback(
    (msg) => {
      const type = msg.type;
      const activeId = activeCommandIdRef.current;

      if (type === "hello") {
        setCameraInfo((prev) => ({
          ...prev,
          camera_id: msg.camera_id,
          state: msg.state,
          message: msg.message,
        }));
        log(`[WS] hello · ${msg.camera_id ?? "camera"} · ${msg.state ?? "—"}`);
        return;
      }

      if (type === "status") {
        setCameraInfo({
          camera_id: msg.camera_id,
          state: msg.state,
          busy: msg.busy,
          current_filter_id: msg.current_filter_id,
          current_filter_nm: msg.current_filter_nm,
          last_error: msg.last_error,
        });
        return;
      }

      if (!activeId || msg.command_id !== activeId) return;

      if (type === "command_ack") {
        if (msg.accepted) {
          setPhase(STATUS.ACCEPTED);
          setStatusText("Calibration accepted...");
          log(`[WS] command_ack · accepted · ${msg.state ?? "—"}`);
        } else {
          const err = formatCommandError(msg.error);
          finishCalibration(STATUS.ERROR, err);
          log(`[WS] command_ack · rejected · ${err}`);
        }
        return;
      }

      if (type === "command_progress") {
        const message =
          msg.progress?.message || "Calibrating filter wheel. Do not touch the camera.";
        setPhase(STATUS.PROGRESS);
        setStatusText(message);
        log(`[WS] progress · ${message}`);
        return;
      }

      if (type === "command_done") {
        if (msg.success) {
          finishCalibration(STATUS.SUCCESS, "Filter calibration completed successfully");
          onSuccessRef.current?.();
          log("[WS] command_done · success");
          if (msg.result) {
            setCameraInfo((prev) => ({
              ...prev,
              current_filter_id: msg.result.current_filter_id ?? prev?.current_filter_id,
              current_filter_nm: msg.result.current_filter_nm ?? prev?.current_filter_nm,
              steps_per_rev: msg.result.steps_per_rev,
            }));
          }
        } else {
          const err = formatCommandError(msg.error);
          finishCalibration(STATUS.ERROR, err);
          log(`[WS] command_done · failed · ${err}`);
        }
      }
    },
    [finishCalibration, log]
  );

  const handleCameraMessageRef = useRef(handleCameraMessage);
  useEffect(() => {
    handleCameraMessageRef.current = handleCameraMessage;
  }, [handleCameraMessage]);

  const connect = useCallback(() => {
    if (unmountedRef.current) return;

    const existing = socketRef.current;
    if (
      existing &&
      (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    if (existing) {
      existing.close();
      socketRef.current = null;
    }

    setConnectionError("");

    if (
      typeof window !== "undefined" &&
      window.location.protocol === "https:" &&
      resolvedUrl.startsWith("ws://")
    ) {
      setConnectionError("HTTPS requires wss:// for the camera WebSocket.");
      return;
    }

    const socket = new WebSocket(resolvedUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      if (unmountedRef.current) return;
      setConnected(true);
      setConnectionError("");
      log(`[WS] connected · ${resolvedUrl}`);

      if (pendingCalibrationRef.current && activeCommandIdRef.current) {
        pendingCalibrationRef.current = false;
        sendCalibrateFilters(socket, activeCommandIdRef.current);
      }
    };

    socket.onmessage = (event) => {
      if (typeof event.data !== "string") return;
      const msg = parseCameraJsonMessage(event.data);
      if (msg) handleCameraMessageRef.current(msg);
    };

    socket.onerror = () => {
      if (unmountedRef.current) return;
      setConnectionError("WebSocket connection error.");
      if (activeCommandIdRef.current) {
        finishCalibration(STATUS.ERROR, "WebSocket connection error.");
      }
    };

    socket.onclose = (ev) => {
      if (unmountedRef.current) return;
      setConnected(false);
      socketRef.current = null;
      if (activeCommandIdRef.current) {
        finishCalibration(
          STATUS.ERROR,
          ev.reason || `Connection closed (code ${ev.code}).`
        );
      }
    };
  }, [resolvedUrl, sendCalibrateFilters, finishCalibration, log]);

  const startCalibration = useCallback(() => {
    if (activeCommandIdRef.current) return;

    const commandId = createCommandId();
    activeCommandIdRef.current = commandId;
    pendingCalibrationRef.current = true;
    setConnectionError("");
    setPhase(STATUS.SENDING);
    setStatusText("Sending calibration command...");

    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      pendingCalibrationRef.current = false;
      sendCalibrateFilters(socket, commandId);
      return;
    }

    connect();
  }, [connect, sendCalibrateFilters]);

  useEffect(() => {
    unmountedRef.current = false;
    connect();
    return () => {
      unmountedRef.current = true;
      pendingCalibrationRef.current = false;
      activeCommandIdRef.current = null;
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [connect]);

  const isCalibrating =
    phase === STATUS.SENDING ||
    phase === STATUS.ACCEPTED ||
    phase === STATUS.PROGRESS;

  const buttonDisabled = isCalibrating;

  return {
    wsUrl: resolvedUrl,
    connected,
    connectionError,
    phase,
    statusText,
    cameraInfo,
    isCalibrating,
    buttonDisabled,
    startCalibration,
    reconnect: connect,
  };
}
