import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CAMERA_SECTION_IDS,
  CAMERA_WORKFLOW_STEP_IDS,
} from "@/lib/cameraDashboardConstants";

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
  const [section, setSection] = useState(CAMERA_SECTION_IDS.CONFIG);
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

  /** Pasos del flujo completados (línea de tiempo del menú). */
  const [workflowCompleted, setWorkflowCompleted] = useState({
    [CAMERA_WORKFLOW_STEP_IDS.CONFIG]: false,
    [CAMERA_WORKFLOW_STEP_IDS.CAL_FILTERS]: false,
    [CAMERA_WORKFLOW_STEP_IDS.CAL_FOCUS]: false,
    [CAMERA_WORKFLOW_STEP_IDS.CAL_WHITE]: false,
    [CAMERA_WORKFLOW_STEP_IDS.CAPTURE]: false,
  });

  const logEndRef = useRef(null);

  const completeWorkflowStep = useCallback((stepId) => {
    setWorkflowCompleted((prev) => {
      if (prev[stepId]) return prev;
      return { ...prev, [stepId]: true };
    });
  }, []);

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
    }),
    [section]
  );

  const workflowStatus = useMemo(() => {
    const hasCompensators =
      activeWhiteReference?.compensators &&
      Object.keys(activeWhiteReference.compensators).length > 0;

    return {
      [CAMERA_WORKFLOW_STEP_IDS.CONFIG]: workflowCompleted.config,
      [CAMERA_WORKFLOW_STEP_IDS.CAL_FILTERS]: workflowCompleted.calFilters,
      [CAMERA_WORKFLOW_STEP_IDS.CAL_FOCUS]:
        workflowCompleted.calFocus || opticalExposureMs != null,
      [CAMERA_WORKFLOW_STEP_IDS.CAL_WHITE]:
        workflowCompleted.calWhite || Boolean(hasCompensators),
      [CAMERA_WORKFLOW_STEP_IDS.CAPTURE]: workflowCompleted.capture,
    };
  }, [workflowCompleted, opticalExposureMs, activeWhiteReference]);

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
    workflowStatus,
    completeWorkflowStep,
    nav,
  };
}
