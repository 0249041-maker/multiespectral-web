/**
 * Estado de sesión del modo captura 1× cubo (fuera del ciclo de vida de un componente).
 * Evita start/finish duplicados por re-renders o React StrictMode.
 */
export const cubeCaptureSession = {
  /** Paneles de captura 1× montados (ref count). */
  mountCount: 0,
  /** Ya se envió start_cube_capture_mode (en vuelo o ack). */
  startRequested: false,
  /** La cámara confirmó cube_capture_mode. */
  modeActive: false,
  /** Ya se envió finish_cube_capture_mode (en vuelo o ack). */
  finishSent: false,
};

export function canRequestCubeCaptureStart() {
  return (
    cubeCaptureSession.mountCount > 0 &&
    !cubeCaptureSession.startRequested &&
    !cubeCaptureSession.modeActive &&
    !cubeCaptureSession.finishSent
  );
}

export function markCubeCaptureStartRequested() {
  cubeCaptureSession.startRequested = true;
}

export function markCubeCaptureStartFailed() {
  cubeCaptureSession.startRequested = false;
}

export function markCubeCaptureModeActive() {
  cubeCaptureSession.modeActive = true;
  cubeCaptureSession.startRequested = true;
}

export function canRequestCubeCaptureFinish() {
  return (
    cubeCaptureSession.modeActive &&
    !cubeCaptureSession.finishSent
  );
}

export function markCubeCaptureFinishSent() {
  cubeCaptureSession.finishSent = true;
}

export function resetCubeCaptureSessionAfterFinish() {
  cubeCaptureSession.modeActive = false;
  cubeCaptureSession.startRequested = false;
  cubeCaptureSession.finishSent = false;
}

/** Tiempo para ignorar un unmount de StrictMode antes de mandar finish. */
export const CUBE_CAPTURE_LEAVE_DEFER_MS = 50;
