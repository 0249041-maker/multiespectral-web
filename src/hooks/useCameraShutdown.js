import { useCallback, useEffect, useRef, useState } from "react";
import {
  useCameraCommandEventListener,
  useCameraWs,
} from "@/context/CameraWebSocketContext";
import { CAMERA_STATE_SHUTTING_DOWN } from "@/lib/cameraDashboardConstants";
import {
  createShutdownCommandId,
  formatCommandError,
  isCameraShuttingDownState,
  isShutdownBlockedState,
} from "@/lib/cameraWsProtocol";

const SHUTDOWN_COMMAND = "shutdown_camera";

/**
 * @param {{ appendLog?: (line: string) => void, setOnline?: (v: boolean) => void, setGlobalStatusKey?: (k: string) => void }} dash
 */
export function useCameraShutdown({ appendLog, setOnline, setGlobalStatusKey } = {}) {
  const ws = useCameraWs();
  const [modalOpen, setModalOpen] = useState(false);
  /** @type {["confirm"|"sending"|"ack_ok"|"progress"|"success"|"error", Function]} */
  const [phase, setPhase] = useState("confirm");
  const [statusMessage, setStatusMessage] = useState("");
  const [errorDetail, setErrorDetail] = useState("");
  const [shutdownPending, setShutdownPending] = useState(false);

  const shutdownCommandIdRef = useRef(null);

  const cameraState = ws.cameraInfo?.state ?? "";
  const shuttingDown =
    isCameraShuttingDownState(cameraState) || phase === "success";

  const shutdownCommandActive =
    shutdownPending ||
    (ws.commandPending && ws.activeCommandName === SHUTDOWN_COMMAND);

  const canShutdown =
    ws.connected &&
    !shutdownCommandActive &&
    !isShutdownBlockedState(cameraState) &&
    !shuttingDown;

  const resetModal = useCallback(() => {
    setPhase("confirm");
    setStatusMessage("");
    setErrorDetail("");
    setShutdownPending(false);
    shutdownCommandIdRef.current = null;
  }, []);

  const openModal = useCallback(() => {
    resetModal();
    setModalOpen(true);
    appendLog?.("[WARN] Solicitud de apagado remoto (modal abierto).");
  }, [appendLog, resetModal]);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    resetModal();
  }, [resetModal]);

  const confirmShutdown = useCallback(() => {
    if (!ws.connected) {
      setPhase("error");
      setStatusMessage("No hay conexión WebSocket con la cámara.");
      return;
    }

    const commandId = createShutdownCommandId();
    shutdownCommandIdRef.current = commandId;
    setShutdownPending(true);
    setPhase("sending");
    setStatusMessage("Enviando comando de apagado…");
    setErrorDetail("");
    appendLog?.(`[WS] → shutdown_camera · ${commandId}`);

    const ok = ws.sendCommand(SHUTDOWN_COMMAND, {}, commandId);
    if (!ok) {
      setShutdownPending(false);
      setPhase("error");
      setStatusMessage("No se pudo enviar el comando de apagado.");
      shutdownCommandIdRef.current = null;
    }
  }, [appendLog, ws]);

  useCameraCommandEventListener(
    useCallback(
      (event) => {
        if (event.command !== SHUTDOWN_COMMAND) return;
        if (
          shutdownCommandIdRef.current &&
          event.commandId !== shutdownCommandIdRef.current
        ) {
          return;
        }

        if (event.phase === "ack") {
          if (!event.accepted) {
            setShutdownPending(false);
            setPhase("error");
            setStatusMessage("No se puede apagar la cámara en este momento.");
            setErrorDetail(formatCommandError(event.error));
            appendLog?.(
              `[ERR] shutdown_camera rechazado · ${formatCommandError(event.error)}`
            );
            return;
          }
          setPhase("ack_ok");
          setStatusMessage("Comando de apagado aceptado…");
          appendLog?.("[OK] shutdown_camera · command_ack accepted");
          return;
        }

        if (event.phase === "progress") {
          setPhase("progress");
          setStatusMessage(
            event.message || "La cámara se está apagando…"
          );
          return;
        }

        if (event.phase === "done") {
          setShutdownPending(false);
          if (event.success) {
            setPhase("success");
            setStatusMessage("La cámara se está apagando.");
            setErrorDetail("");
            setOnline?.(false);
            setGlobalStatusKey?.("error");
            appendLog?.(
              "[OK] shutdown_camera · la Raspberry se está apagando"
            );
            if (event.state) {
              appendLog?.(`[WS] state → ${event.state}`);
            }
          } else {
            setPhase("error");
            setStatusMessage("No se pudo completar el apagado de la cámara.");
            setErrorDetail(formatCommandError(event.error));
            appendLog?.(
              `[ERR] shutdown_camera · ${formatCommandError(event.error)}`
            );
          }
        }
      },
      [appendLog, setGlobalStatusKey, setOnline]
    )
  );

  useEffect(() => {
    if (isCameraShuttingDownState(cameraState) && phase !== "success") {
      setPhase("success");
      setStatusMessage("La cámara se está apagando.");
      setOnline?.(false);
    }
  }, [cameraState, phase, setOnline]);

  return {
    modalOpen,
    openModal,
    closeModal,
    confirmShutdown,
    phase,
    statusMessage,
    errorDetail,
    canShutdown,
    shuttingDown,
    shutdownCommandActive,
    cameraState,
    shuttingDownLabel: CAMERA_STATE_SHUTTING_DOWN,
  };
}
