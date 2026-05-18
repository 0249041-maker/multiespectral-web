import {
  CAMERA_LIVE_WS_URL,
  CAMERA_STATE_CUBE_CAPTURE,
  WAVELENGTH_FILTERS,
} from "@/lib/cameraDashboardConstants";

/**
 * @param {string | undefined | null} state
 */
export function isCubeCaptureCameraState(state) {
  if (typeof state !== "string" || !state.trim()) return false;
  const s = state.trim().toLowerCase();
  return s === CAMERA_STATE_CUBE_CAPTURE || s === "cube_capture";
}

const WS_URL_STORAGE_KEY = "camera-ws-url";

/** Resuelve URL del WebSocket de cámara (fija > env > localStorage > default). */
export function resolveCameraWsUrl(fixedUrl) {
  if (typeof fixedUrl === "string" && fixedUrl.trim().match(/^wss?:\/\//)) {
    return fixedUrl.trim();
  }
  const fromEnv = import.meta.env.VITE_CAMERA_WS_URL;
  if (typeof fromEnv === "string" && fromEnv.trim().match(/^wss?:\/\//)) {
    return fromEnv.trim();
  }
  try {
    const saved = window.localStorage.getItem(WS_URL_STORAGE_KEY);
    if (saved && (saved.startsWith("ws://") || saved.startsWith("wss://"))) {
      return saved;
    }
  } catch {
    // ignore
  }
  return CAMERA_LIVE_WS_URL;
}

export function persistCameraWsUrl(url) {
  try {
    window.localStorage.setItem(WS_URL_STORAGE_KEY, url);
  } catch {
    // ignore
  }
}

export function createCommandId() {
  return `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export function createStartCubeModeCommandId() {
  return `cmd_start_cube_mode_${Date.now()}`;
}

export function createCaptureCubeCommandId() {
  return `cmd_capture_cube_${Date.now()}`;
}

export function createFinishCubeModeCommandId() {
  return `cmd_finish_cube_mode_${Date.now()}`;
}

/** @param {string} command @param {Record<string, unknown>} [payload] */
export function buildCameraCommand(command, commandId, payload = {}) {
  return {
    type: "command",
    command_id: commandId,
    command,
    payload,
  };
}

export function buildCalibrateFiltersCommand(commandId) {
  return buildCameraCommand("calibrate_filters", commandId, {});
}

export function buildStartOpticalCalibrationCommand(commandId, exposureMs) {
  return buildCameraCommand("start_optical_calibration", commandId, {
    exposure_ms: exposureMs,
  });
}

export function buildSetExposureCommand(commandId, exposureMs) {
  return buildCameraCommand("set_exposure", commandId, { exposure_ms: exposureMs });
}

export function buildMoveFilterByNmCommand(commandId, filterNm) {
  return buildCameraCommand("move_filter", commandId, { filter_nm: filterNm });
}

export function buildMoveFilterByIdCommand(commandId, filterId) {
  return buildCameraCommand("move_filter", commandId, { filter_id: filterId });
}

export function buildFinishOpticalCalibrationCommand(commandId) {
  return buildCameraCommand("finish_optical_calibration", commandId, {});
}

export function buildStartWhiteCalibrationCommand(commandId) {
  return buildCameraCommand("start_white_calibration", commandId, {});
}

export function buildCaptureWhiteReferenceCommand(commandId, name = "white_reference") {
  return buildCameraCommand("capture_white_reference", commandId, { name });
}

export function buildFinishWhiteCalibrationCommand(commandId) {
  return buildCameraCommand("finish_white_calibration", commandId, {});
}

/**
 * @param {string} name
 * @param {number} exposureMs
 * @param {{ cube_id: string, compensators: Record<string, number> }} whiteReference
 */
export function buildCaptureCubePayload(name, exposureMs, whiteReference) {
  return {
    name,
    exposure_ms: exposureMs,
    white_reference: {
      cube_id: whiteReference.cube_id,
      compensators: whiteReference.compensators,
    },
  };
}

export function findFilterById(filterId) {
  return WAVELENGTH_FILTERS.find((f) => f.id === filterId) ?? null;
}

export function findFilterByNm(filterNm) {
  return WAVELENGTH_FILTERS.find((f) => f.nm === filterNm) ?? null;
}

/**
 * @param {unknown} raw
 * @returns {Record<string, unknown> | null}
 */
export function parseCameraJsonMessage(raw) {
  if (typeof raw !== "string") return null;
  try {
    const msg = JSON.parse(raw);
    return msg && typeof msg === "object" ? msg : null;
  } catch {
    return null;
  }
}

export function formatCommandError(error) {
  if (!error || typeof error !== "object") return "Unknown error";
  const e = /** @type {{ message?: string; code?: string }} */ (error);
  if (e.message) return e.code ? `${e.code}: ${e.message}` : e.message;
  return e.code || "Unknown error";
}
