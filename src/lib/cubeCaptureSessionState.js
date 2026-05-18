import {
  isCubeCaptureCameraState,
  isCubeCaptureModeFullyActive,
} from "@/lib/cameraWsProtocol";

/**
 * Estado de sesión del modo captura 1× cubo (compartido entre montajes del panel).
 * Las decisiones start/finish priorizan el `state` de la cámara (status/hello).
 */
export const cubeCaptureSession = {
  mountCount: 0,
  /** Comando start enviado y pendiente de command_done */
  startPending: false,
  /** Ya se intentó start en esta visita al apartado (bloquea reenvíos automáticos) */
  startAttempted: false,
  /** command_done de start falló; requiere reintento manual o auto limitado */
  startFailed: false,
  startError: "",
  autoRetryCount: 0,
  lastStartSentAt: 0,
  lastCameraState: "",
  finishSent: false,
};

export const CUBE_CAPTURE_LEAVE_DEFER_MS = 50;
export const CUBE_CAPTURE_MAX_AUTO_START_RETRIES = 2;
export const CUBE_CAPTURE_START_RETRY_COOLDOWN_MS = 5000;

export function setCubeCaptureCameraState(state) {
  cubeCaptureSession.lastCameraState =
    typeof state === "string" ? state : "";
}

export function isCameraInCubeCaptureMode() {
  return isCubeCaptureCameraState(cubeCaptureSession.lastCameraState);
}

/**
 * @param {import("@/lib/cameraWsProtocol").CameraInfoLike | null | undefined} cameraInfo
 */
export function isCameraCubeCaptureLiveActive(cameraInfo) {
  return isCubeCaptureModeFullyActive(cameraInfo);
}

/**
 * @param {string | undefined | null} [cameraState]
 */
export function canRequestCubeCaptureStart(cameraState) {
  const state = cameraState ?? cubeCaptureSession.lastCameraState;
  if (cubeCaptureSession.mountCount <= 0) return false;
  if (isCubeCaptureCameraState(state)) return false;
  if (cubeCaptureSession.finishSent) return false;
  if (cubeCaptureSession.startPending) return false;
  if (cubeCaptureSession.startAttempted) return false;
  if (cubeCaptureSession.startFailed) return false;
  return true;
}

export function canRetryCubeCaptureStart(cameraState) {
  const state = cameraState ?? cubeCaptureSession.lastCameraState;
  if (cubeCaptureSession.mountCount <= 0) return false;
  if (isCubeCaptureCameraState(state)) return false;
  if (cubeCaptureSession.startPending) return false;
  if (!cubeCaptureSession.startFailed) return false;
  return true;
}

export function canScheduleAutoStartRetry() {
  return (
    cubeCaptureSession.startFailed &&
    cubeCaptureSession.autoRetryCount < CUBE_CAPTURE_MAX_AUTO_START_RETRIES
  );
}

export function markCubeCaptureStartRequested() {
  cubeCaptureSession.startPending = true;
  cubeCaptureSession.startAttempted = true;
  cubeCaptureSession.startFailed = false;
  cubeCaptureSession.startError = "";
  cubeCaptureSession.lastStartSentAt = Date.now();
}

/**
 * @param {string} [message]
 */
export function markCubeCaptureStartFailed(message = "") {
  cubeCaptureSession.startPending = false;
  cubeCaptureSession.startFailed = true;
  cubeCaptureSession.startError = message;
}

export function markCubeCaptureAutoRetryScheduled() {
  cubeCaptureSession.autoRetryCount += 1;
}

export function prepareCubeCaptureStartRetry() {
  cubeCaptureSession.startPending = false;
  cubeCaptureSession.startAttempted = false;
  cubeCaptureSession.startFailed = false;
  cubeCaptureSession.startError = "";
}

/** La cámara ya está en cube_capture_mode con live activo (status), sin mandar start. */
export function applyCubeCaptureModeFromCameraStatus() {
  cubeCaptureSession.startPending = false;
  cubeCaptureSession.startFailed = false;
  cubeCaptureSession.startError = "";
  cubeCaptureSession.startAttempted = false;
  cubeCaptureSession.finishSent = false;
}

export function markCubeCaptureStartAcknowledged() {
  applyCubeCaptureModeFromCameraStatus();
}

/**
 * @param {string | undefined | null} [cameraState]
 */
export function canRequestCubeCaptureFinish(cameraState) {
  const state = cameraState ?? cubeCaptureSession.lastCameraState;
  if (cubeCaptureSession.finishSent) return false;
  return isCubeCaptureCameraState(state);
}

export function markCubeCaptureFinishSent() {
  cubeCaptureSession.finishSent = true;
  cubeCaptureSession.startPending = false;
  cubeCaptureSession.startAttempted = false;
  cubeCaptureSession.startFailed = false;
  cubeCaptureSession.startError = "";
}

export function resetCubeCaptureSessionAfterFinish() {
  cubeCaptureSession.startPending = false;
  cubeCaptureSession.startAttempted = false;
  cubeCaptureSession.startFailed = false;
  cubeCaptureSession.startError = "";
  cubeCaptureSession.autoRetryCount = 0;
  cubeCaptureSession.finishSent = false;
}

export function resetCubeCaptureSessionOnEnter() {
  cubeCaptureSession.startPending = false;
  cubeCaptureSession.startAttempted = false;
  cubeCaptureSession.startFailed = false;
  cubeCaptureSession.startError = "";
  cubeCaptureSession.autoRetryCount = 0;
  cubeCaptureSession.finishSent = false;
}
