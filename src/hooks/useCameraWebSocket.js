import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildCameraCommand,
  createCommandId,
  formatCommandError,
  parseCameraJsonMessage,
  resolveCameraWsUrl,
} from "@/lib/cameraWsProtocol";

/**
 * WebSocket de cámara: mensajes JSON (texto) + fotogramas JPEG (binario).
 * @param {{
 *   wsUrl?: string,
 *   appendLog?: (line: string) => void,
 *   onCommandDone?: (info: { command: string, success: boolean, result?: unknown, error?: unknown }) => void,
 *   onCommandEvent?: (info: CameraCommandEvent) => void,
 * }} options
 */
export function useCameraWebSocket({ wsUrl: fixedWsUrl, appendLog, onCommandDone, onCommandEvent } = {}) {
  const resolvedUrl = resolveCameraWsUrl(fixedWsUrl);

  const socketRef = useRef(null);
  const activeCommandRef = useRef(null);
  const pendingSendRef = useRef(null);
  const unmountedRef = useRef(false);
  const livePausedRef = useRef(false);
  const liveViewSuppressedRef = useRef(false);
  const appendLogRef = useRef(appendLog);
  const onCommandDoneRef = useRef(onCommandDone);
  const onCommandEventRef = useRef(onCommandEvent);
  const lastObjectUrlRef = useRef(null);

  const mergeCameraState = useCallback((state) => {
    if (typeof state !== "string" || !state.trim()) return;
    setCameraInfo((prev) => ({
      ...prev,
      state,
    }));
  }, []);

  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const [cameraInfo, setCameraInfo] = useState(null);
  const [frameUrl, setFrameUrl] = useState("");
  const [livePaused, setLivePaused] = useState(false);
  const [switchingFilter, setSwitchingFilter] = useState(false);
  const [capturingCube, setCapturingCube] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [commandPending, setCommandPending] = useState(false);
  const [activeCommandName, setActiveCommandName] = useState(null);
  const [liveViewBlanked, setLiveViewBlanked] = useState(false);

  useEffect(() => {
    appendLogRef.current = appendLog;
  }, [appendLog]);

  useEffect(() => {
    onCommandDoneRef.current = onCommandDone;
  }, [onCommandDone]);

  useEffect(() => {
    onCommandEventRef.current = onCommandEvent;
  }, [onCommandEvent]);

  const emitCommandEvent = useCallback((info) => {
    onCommandEventRef.current?.(info);
  }, []);

  const log = useCallback((line) => {
    appendLogRef.current?.(line);
  }, []);

  const clearCommand = useCallback(() => {
    activeCommandRef.current = null;
    pendingSendRef.current = null;
    setCommandPending(false);
    setActiveCommandName(null);
  }, []);

  const clearLiveFrame = useCallback(() => {
    if (lastObjectUrlRef.current) {
      URL.revokeObjectURL(lastObjectUrlRef.current);
      lastObjectUrlRef.current = null;
    }
    setFrameUrl("");
  }, []);

  const setLiveViewSuppressed = useCallback(
    (suppressed) => {
      liveViewSuppressedRef.current = suppressed;
      setLiveViewBlanked(suppressed);
      if (suppressed) clearLiveFrame();
    },
    [clearLiveFrame]
  );

  const applyJpegFrame = useCallback((arrayBuffer) => {
    if (livePausedRef.current || liveViewSuppressedRef.current) return;

    const blob = new Blob([arrayBuffer], { type: "image/jpeg" });
    const url = URL.createObjectURL(blob);
    setFrameUrl(url);
    if (lastObjectUrlRef.current) {
      URL.revokeObjectURL(lastObjectUrlRef.current);
    }
    lastObjectUrlRef.current = url;
  }, []);

  const handleCameraMessage = useCallback(
    (msg) => {
      const type = msg.type;

      if (type === "hello") {
        setCameraInfo((prev) => ({
          ...prev,
          camera_id: msg.camera_id,
          state: msg.state,
          message: msg.message,
          live_view: msg.live_view ?? prev?.live_view,
        }));
        log(`[WS] hello · ${msg.camera_id ?? "camera"} · ${msg.state ?? "—"}`);
        return;
      }

      if (type === "status") {
        setCameraInfo({
          camera_id: msg.camera_id,
          state: msg.state,
          busy: msg.busy,
          live_view: msg.live_view,
          current_filter_id: msg.current_filter_id,
          current_filter_nm: msg.current_filter_nm,
          last_error: msg.last_error,
        });
        return;
      }

      if (type === "live_started") {
        setCameraInfo((prev) => ({
          ...prev,
          camera_id: msg.camera_id ?? prev?.camera_id,
          state: msg.state ?? prev?.state,
          busy: msg.busy ?? prev?.busy,
          live_view: msg.live_view ?? true,
          current_filter_id: msg.current_filter_id ?? prev?.current_filter_id,
          current_filter_nm: msg.current_filter_nm ?? prev?.current_filter_nm,
        }));
        log(`[WS] live_started · ${msg.state ?? "—"}`);
        return;
      }

      if (type === "live_paused") {
        livePausedRef.current = true;
        setLivePaused(true);
        const isFilterSwitch = msg.reason === "switching_filter";
        const isCapturingCube = msg.reason === "capturing_cube";
        setSwitchingFilter(isFilterSwitch);
        setCapturingCube(isCapturingCube);
        if (isFilterSwitch) {
          log("[WS] live_paused · switching_filter");
        } else if (isCapturingCube) {
          log("[WS] live_paused · capturing_cube");
        }
        return;
      }

      if (type === "live_resumed") {
        livePausedRef.current = false;
        setLivePaused(false);
        setSwitchingFilter(false);
        setCapturingCube(false);
        log("[WS] live_resumed");
        return;
      }

      const active = activeCommandRef.current;
      if (!active || msg.command_id !== active.id) return;

      if (type === "command_ack") {
        mergeCameraState(msg.state);
        if (msg.accepted) {
          setStatusText(`Command accepted: ${active.command}`);
          log(`[WS] command_ack · ${active.command} · accepted`);
          emitCommandEvent({
            phase: "ack",
            command: active.command,
            commandId: active.id,
            accepted: true,
            state: msg.state,
          });
        } else {
          const err = formatCommandError(msg.error);
          setStatusText(err);
          clearCommand();
          emitCommandEvent({
            phase: "ack",
            command: active.command,
            commandId: active.id,
            accepted: false,
            error: msg.error,
            state: msg.state,
          });
          onCommandDoneRef.current?.({
            command: active.command,
            success: false,
            error: msg.error,
          });
          log(`[WS] command_ack · ${active.command} · rejected · ${err}`);
        }
        return;
      }

      if (type === "command_progress") {
        const message = msg.progress?.message || "Processing…";
        mergeCameraState(msg.state);
        setStatusText(message);
        log(`[WS] progress · ${active.command} · ${message}`);
        emitCommandEvent({
          phase: "progress",
          command: active.command,
          commandId: active.id,
          message,
          state: msg.state,
        });
        return;
      }

      if (type === "command_done") {
        const command = active.command;
        mergeCameraState(msg.state);
        clearCommand();
        if (msg.success) {
          setStatusText(`Completed: ${command}`);
          emitCommandEvent({
            phase: "done",
            command,
            commandId: active.id,
            success: true,
            result: msg.result,
            state: msg.state,
          });
          onCommandDoneRef.current?.({
            command,
            success: true,
            result: msg.result,
          });
          log(`[WS] command_done · ${command} · success`);
          if (msg.result && typeof msg.result === "object") {
            setCameraInfo((prev) => ({
              ...prev,
              ...(/** @type {Record<string, unknown>} */ (msg.result)),
            }));
          }
        } else {
          const err = formatCommandError(msg.error);
          setStatusText(err);
          emitCommandEvent({
            phase: "done",
            command,
            commandId: active.id,
            success: false,
            error: msg.error,
            state: msg.state,
          });
          onCommandDoneRef.current?.({
            command,
            success: false,
            error: msg.error,
          });
          log(`[WS] command_done · ${command} · failed · ${err}`);
        }
      }
    },
    [clearCommand, emitCommandEvent, log, mergeCameraState]
  );

  const handleCameraMessageRef = useRef(handleCameraMessage);
  useEffect(() => {
    handleCameraMessageRef.current = handleCameraMessage;
  }, [handleCameraMessage]);

  const flushPendingSend = useCallback(() => {
    const pending = pendingSendRef.current;
    const socket = socketRef.current;
    if (!pending || !socket || socket.readyState !== WebSocket.OPEN) return;

    pendingSendRef.current = null;
    const { command, payload, commandId } = pending;
    activeCommandRef.current = { id: commandId, command };
    setCommandPending(true);
    setActiveCommandName(command);
    setStatusText(`Sending ${command}…`);
    socket.send(JSON.stringify(buildCameraCommand(command, commandId, payload)));
    log(`[WS] → ${command} · ${commandId}`);
  }, [log]);

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
    socket.binaryType = "arraybuffer";
    socketRef.current = socket;

    socket.onopen = () => {
      if (unmountedRef.current) return;
      setConnected(true);
      setConnectionError("");
      log(`[WS] connected · ${resolvedUrl}`);
      flushPendingSend();
    };

    socket.onmessage = (event) => {
      if (typeof event.data === "string") {
        const msg = parseCameraJsonMessage(event.data);
        if (msg) handleCameraMessageRef.current(msg);
        return;
      }
      applyJpegFrame(event.data);
    };

    socket.onerror = () => {
      if (unmountedRef.current) return;
      setConnectionError("WebSocket connection error.");
      if (activeCommandRef.current) {
        setStatusText("WebSocket connection error.");
        clearCommand();
      }
    };

    socket.onclose = (ev) => {
      if (unmountedRef.current) return;
      setConnected(false);
      socketRef.current = null;
      if (activeCommandRef.current) {
        setStatusText(ev.reason || `Connection closed (code ${ev.code}).`);
        clearCommand();
      }
    };
  }, [resolvedUrl, flushPendingSend, applyJpegFrame, clearCommand, log]);

  const sendCommand = useCallback(
    (command, payload = {}, commandIdOverride) => {
      if (activeCommandRef.current) return false;

      const commandId =
        typeof commandIdOverride === "string" && commandIdOverride.trim()
          ? commandIdOverride.trim()
          : createCommandId();
      pendingSendRef.current = { command, payload, commandId };

      const socket = socketRef.current;
      if (socket?.readyState === WebSocket.OPEN) {
        flushPendingSend();
        return true;
      }

      connect();
      return true;
    },
    [connect, flushPendingSend]
  );

  useEffect(() => {
    unmountedRef.current = false;
    connect();
    return () => {
      unmountedRef.current = true;
      pendingSendRef.current = null;
      activeCommandRef.current = null;
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      if (lastObjectUrlRef.current) {
        URL.revokeObjectURL(lastObjectUrlRef.current);
        lastObjectUrlRef.current = null;
      }
    };
  }, [connect]);

  return {
    wsUrl: resolvedUrl,
    connected,
    connectionError,
    cameraInfo,
    frameUrl,
    livePaused,
    switchingFilter,
    capturingCube,
    statusText,
    commandPending,
    activeCommandName,
    sendCommand,
    reconnect: connect,
    clearLiveFrame,
    setLiveViewSuppressed,
    liveViewBlanked,
  };
}

/**
 * @typedef {{
 *   phase: "ack",
 *   command: string,
 *   commandId: string,
 *   accepted: boolean,
 *   error?: unknown,
 *   state?: string,
 * } | {
 *   phase: "progress",
 *   command: string,
 *   commandId: string,
 *   message?: string,
 *   state?: string,
 * } | {
 *   phase: "done",
 *   command: string,
 *   commandId: string,
 *   success: boolean,
 *   error?: unknown,
 *   result?: unknown,
 *   state?: string,
 * }} CameraCommandEvent
 */
