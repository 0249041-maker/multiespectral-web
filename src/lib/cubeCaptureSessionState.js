import { isCubeCaptureCameraState } from "@/lib/cameraWsProtocol";

/**
 * Estado de sesión del modo captura 1× cubo (compartido entre montajes del panel).
 * Las decisiones start/finish priorizan el `state` de la cámara (status/hello).
 */
export const cubeCaptureSession = {
  mountCount: 0,
  /** start enviado y aún sin ack ni status en cube_capture_mode */
  startRequested: false,
  /** Último state conocido de la cámara (hello/status) */
  lastCameraState: "",
  finishSent: false,
};

export function setCubeCaptureCameraState(state) {
  cubeCaptureSession.lastCameraState =
    typeof state === "string" ? state : "";
}

export function isCameraInCubeCaptureMode() {
  return isCubeCaptureCameraState(cubeCaptureSession.lastCameraState);
}

/**
 * @param {string | undefined | null} [cameraState]
 */
export function canRequestCubeCaptureStart(cameraState) {
  const state = cameraState ?? cubeCaptureSession.lastCameraState;
  if (cubeCaptureSession.mountCount <= 0) return false;
  if (isCubeCaptureCameraState(state)) return false;
  if (cubeCaptureSession.finishSent) return false;
  if (cubeCaptureSession.startRequested) return false;
  return true;
}

export function markCubeCaptureStartRequested() {
  cubeCaptureSession.startRequested = true;
}

export function markCubeCaptureStartFailed() {
  cubeCaptureSession.startRequested = false;
}

/** La cámara ya está en cube_capture_mode (status), sin mandar start. */
export function applyCubeCaptureModeFromCameraStatus() {
  cubeCaptureSession.startRequested = false;
  cubeCaptureSession.finishSent = false;
}

export function markCubeCaptureStartAcknowledged() {
  cubeCaptureSession.startRequested = false;
  cubeCaptureSession.finishSent = false;
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
  cubeCaptureSession.startRequested = false;
}

export function resetCubeCaptureSessionAfterFinish() {
  cubeCaptureSession.startRequested = false;
  cubeCaptureSession.finishSent = false;
}

export const CUBE_CAPTURE_LEAVE_DEFER_MS = 50;
