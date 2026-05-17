import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CAMERA_SECTION_IDS } from "@/lib/cameraDashboardConstants";

const INITIAL_LOGS = [
  "[INFO] Multiespectral camera UI shell iniciado (mock).",
  "[INFO] Esperando conexión de hardware…",
];

function ts() {
  const d = new Date();
  return d.toLocaleTimeString("es", { hour12: false });
}

/**
 * @typedef {{
 *   cube_id: string,
 *   storage_path?: string,
 *   exposure_ms?: number,
 *   bucket?: string,
 *   compensators: Record<string, number>,
 * }} ActiveWhiteReference
 */

export function useCameraDashboardMocks() {
  const [section, setSection] = useState(CAMERA_SECTION_IDS.STATUS);
  const [logs, setLogs] = useState(INITIAL_LOGS);
  const [globalStatusKey, setGlobalStatusKey] = useState("online");
  const [online, setOnline] = useState(true);
  const [lastSeen] = useState(() =>
    new Date().toLocaleString("es", { dateStyle: "short", timeStyle: "medium" })
  );
  const [wifiSignal] = useState(82);
  const [serverOk] = useState(true);
  const [ledPattern, setLedPattern] = useState("spinner");
  const [ledColor, setLedColor] = useState("emerald");
  const [shutdownOpen, setShutdownOpen] = useState(false);

  /** Exposición definida en calibración óptica (ms). */
  const [opticalExposureMs, setOpticalExposureMs] = useState(null);

  /** Referencia blanca activa con valores numéricos por banda. */
  const [activeWhiteReference, setActiveWhiteReference] = useState(
    /** @type {ActiveWhiteReference | null} */ (null)
  );

  const logEndRef = useRef(null);

  const appendLog = useCallback((line) => {
    setLogs((prev) => [...prev.slice(-400), `[${ts()}] ${line}`]);
  }, []);

  const startCalibrationLed = useCallback((pattern, colorKey = "white") => {
    setLedPattern(pattern);
    setLedColor(colorKey);
    setGlobalStatusKey("calibrating");
  }, []);

  const finishCalibrationLed = useCallback((pattern, colorKey = "green") => {
    setLedPattern(pattern);
    setLedColor(colorKey);
    setGlobalStatusKey("online");
  }, []);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollTop = logEndRef.current.scrollHeight;
    }
  }, [logs]);

  const nav = useMemo(
    () => ({
      section,
      setSection,
      goLive: () => setSection(CAMERA_SECTION_IDS.LIVE),
    }),
    [section]
  );

  return {
    section,
    setSection,
    logs,
    appendLog,
    logScrollRef: logEndRef,
    globalStatusKey,
    setGlobalStatusKey,
    online,
    setOnline,
    lastSeen,
    wifiSignal,
    serverOk,
    ledPattern,
    setLedPattern,
    ledColor,
    setLedColor,
    startCalibrationLed,
    finishCalibrationLed,
    shutdownOpen,
    setShutdownOpen,
    opticalExposureMs,
    setOpticalExposureMs,
    activeWhiteReference,
    setActiveWhiteReference,
    nav,
  };
}
