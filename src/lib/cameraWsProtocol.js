import { CAMERA_LIVE_WS_URL, WAVELENGTH_FILTERS } from "@/lib/cameraDashboardConstants";

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
