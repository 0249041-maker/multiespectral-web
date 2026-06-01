import CameraLogConsole from "@/components/camera/CameraLogConsole.jsx";
import OpticalLiveView from "@/components/camera/OpticalLiveView.jsx";
import NeoPixelRing from "@/components/camera/NeoPixelRing.jsx";
import PanelCalWhite from "@/components/camera/PanelCalWhite.jsx";
import { useOpticalCalibration } from "@/hooks/useOpticalCalibration";
import {
  CALIBRATION_LED,
  CAMERA_LIVE_WS_URL,
  CAMERA_SECTION_IDS,
  CAMERA_WORKFLOW_STEP_IDS,
  WAVELENGTH_FILTERS,
} from "@/lib/cameraDashboardConstants";
import { useFilterCalibration } from "@/hooks/useFilterCalibration";
import { useCubeCaptureMode } from "@/hooks/useCubeCaptureMode";
import { useCallback, useEffect, useRef, useState } from "react";

function Card({ title, subtitle, children, className = "" }) {
  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5 ${className}`}
    >
      {(title || subtitle) && (
        <header className="mb-4">
          {title ? (
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          ) : null}
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
        </header>
      )}
      {children}
    </section>
  );
}

const DEFAULT_WIFI_NETWORKS = [
  { ssid: "Nothing", password: "Diego123", signal: 78 },
];

function PanelConfig({ dash }) {
  const [networks, setNetworks] = useState(DEFAULT_WIFI_NETWORKS);
  const [editingIndex, setEditingIndex] = useState(
    /** @type {number | null} */ (null)
  );
  const [draft, setDraft] = useState({ ssid: "", password: "", signal: "70" });
  const [addingNew, setAddingNew] = useState(false);

  const appendLog = dash.appendLog;

  useEffect(() => {
    if (networks.length > 0) {
      dash.completeWorkflowStep(CAMERA_WORKFLOW_STEP_IDS.CONFIG);
    }
  }, [networks.length, dash.completeWorkflowStep]);

  const startEdit = (idx) => {
    const n = networks[idx];
    setAddingNew(false);
    setEditingIndex(idx);
    setDraft({
      ssid: n.ssid,
      password: n.password,
      signal: String(n.signal),
    });
  };

  const startAdd = () => {
    setEditingIndex(null);
    setAddingNew(true);
    setDraft({ ssid: "", password: "", signal: "70" });
  };

  const cancelForm = () => {
    setEditingIndex(null);
    setAddingNew(false);
    setDraft({ ssid: "", password: "", signal: "70" });
  };

  const saveForm = () => {
    const ssid = draft.ssid.trim();
    const password = draft.password;
    const signal = Number.parseInt(draft.signal, 10);
    if (!ssid) {
      appendLog("[ERR] El nombre de la red (SSID) es obligatorio.");
      return;
    }
    if (!password) {
      appendLog("[ERR] La contraseña es obligatoria.");
      return;
    }
    const entry = {
      ssid,
      password,
      signal: Number.isFinite(signal) ? Math.max(0, Math.min(100, signal)) : 70,
    };

    if (addingNew) {
      setNetworks((prev) => [...prev, entry]);
      appendLog(`[UI] Red agregada · ${ssid}`);
    } else if (editingIndex != null) {
      setNetworks((prev) =>
        prev.map((n, i) => (i === editingIndex ? entry : n))
      );
      appendLog(`[UI] Red actualizada · ${ssid}`);
    }
    cancelForm();
  };

  const showForm = addingNew || editingIndex != null;

  return (
    <Card title="Redes WiFi guardadas" subtitle="Configura SSID y contraseña para el instrumento.">
      <ul className="space-y-2">
        {networks.map((n, idx) => (
          <li
            key={`${n.ssid}-${idx}`}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <p className="font-mono text-sm font-medium text-slate-800">{n.ssid}</p>
              <p className="font-mono text-xs text-slate-500">
                Contraseña: {"•".repeat(Math.min(n.password.length, 12))}
                {n.password.length > 12 ? "…" : ""} · {n.signal}% señal
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
                onClick={() => startEdit(idx)}
                disabled={showForm}
              >
                Editar
              </button>
              <button
                type="button"
                className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                disabled={showForm || networks.length <= 1}
                onClick={() => {
                  setNetworks((prev) => prev.filter((_, i) => i !== idx));
                  appendLog(`[UI] Red eliminada · ${n.ssid}`);
                  if (editingIndex === idx) cancelForm();
                }}
              >
                Eliminar
              </button>
            </div>
          </li>
        ))}
      </ul>

      {showForm ? (
        <div className="mt-4 space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
          <p className="text-sm font-medium text-slate-800">
            {addingNew ? "Nueva red WiFi" : "Editar red WiFi"}
          </p>
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
              Nombre de red (SSID)
            </span>
            <input
              type="text"
              value={draft.ssid}
              onChange={(e) => setDraft((d) => ({ ...d, ssid: e.target.value }))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
              Contraseña
            </span>
            <input
              type="password"
              value={draft.password}
              onChange={(e) => setDraft((d) => ({ ...d, password: e.target.value }))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
              Señal estimada (%)
            </span>
            <input
              type="number"
              min={0}
              max={100}
              value={draft.signal}
              onChange={(e) => setDraft((d) => ({ ...d, signal: e.target.value }))}
              className="w-28 rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={saveForm}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Guardar
            </button>
            <button
              type="button"
              onClick={cancelForm}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="mt-3 rounded-xl border border-dashed border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-900 hover:bg-emerald-100"
          onClick={startAdd}
        >
          + Agregar red
        </button>
      )}

      <div className="mt-6 border-t border-slate-200 pt-4">
        <header className="mb-3">
          <h3 className="text-base font-semibold text-slate-900">Consola</h3>
          <p className="mt-1 text-sm text-slate-500">
            Misma fuente de logs del sistema + scroll.
          </p>
        </header>
        <CameraLogConsole
          ref={dash.logScrollRef}
          lines={dash.logs}
          className="min-h-[280px]"
        />
        <button
          type="button"
          className="mt-3 rounded-lg border border-slate-300 px-3 py-1.5 font-mono text-xs text-slate-600 hover:bg-slate-100"
          onClick={() =>
            appendLog("[INFO] Entrada manual de prueba desde panel de configuración.")
          }
        >
          Añadir log de prueba
        </button>
      </div>
    </Card>
  );
}

function PanelCalFilters({ dash }) {
  const cal = useFilterCalibration({
    wsUrl: CAMERA_LIVE_WS_URL,
    appendLog: dash.appendLog,
    onCalibrationSuccess: () => {
      dash.completeWorkflowStep(CAMERA_WORKFLOW_STEP_IDS.CAL_FILTERS);
      dash.finishCalibrationLed(
        CALIBRATION_LED.FILTERS_DONE.pattern,
        CALIBRATION_LED.FILTERS_DONE.color
      );
    },
  });

  const statusTone =
    cal.phase === "success"
      ? "text-emerald-700"
      : cal.phase === "error"
        ? "text-red-700"
        : cal.isCalibrating
          ? "text-amber-700"
          : "text-slate-600";

  return (
    <Card title="Calibración de filtros">
      {cal.cameraInfo ? (
        <dl className="mb-4 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-xs sm:grid-cols-3">
          <div>
            <dt className="text-[10px] uppercase text-slate-500">Cámara</dt>
            <dd className="text-slate-800">{cal.cameraInfo.camera_id ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase text-slate-500">Estado</dt>
            <dd className="text-emerald-700">{cal.cameraInfo.state ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase text-slate-500">Filtro actual</dt>
            <dd className="text-slate-800">
              {cal.cameraInfo.current_filter_nm != null
                ? `${cal.cameraInfo.current_filter_nm} nm`
                : "—"}
            </dd>
          </div>
        </dl>
      ) : null}

      <div className="flex flex-col items-start gap-1.5">
        <button
          type="button"
          disabled={cal.buttonDisabled || !cal.connected}
          onClick={() => {
            dash.startCalibrationLed(
              CALIBRATION_LED.FILTERS.pattern,
              CALIBRATION_LED.FILTERS.color
            );
            cal.startCalibration();
          }}
          className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 font-semibold text-white shadow-[0_0_20px_rgba(16,185,129,0.25)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {cal.isCalibrating ? "Calibrando…" : "Iniciar calibración"}
        </button>
        {!cal.connected ? (
          <div className="flex items-center gap-2 pl-1 text-[11px]">
            <span className="font-medium text-red-700">Cámara sin conexión</span>
            <button
              type="button"
              onClick={cal.reconnect}
              className="font-semibold text-red-700 underline underline-offset-2 hover:no-underline"
            >
              Reintentar
            </button>
          </div>
        ) : null}
      </div>

      {cal.statusText ? (
        <p className={`mt-4 text-sm font-medium ${statusTone}`}>{cal.statusText}</p>
      ) : null}

      {cal.isCalibrating ? (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-gradient-to-r from-emerald-500 to-teal-400" />
        </div>
      ) : null}

      {import.meta.env.DEV ? (
        <p className="mt-4 font-mono text-[10px] text-slate-400">
          Debug: define <code>VITE_CAMERA_WS_URL</code> o localStorage{" "}
          <code>camera-ws-url</code> para otra URL.
        </p>
      ) : null}
    </Card>
  );
}

function PanelCalFocusAperture({ dash }) {
  const optical = useOpticalCalibration({
    wsUrl: CAMERA_LIVE_WS_URL,
    appendLog: dash.appendLog,
    onSessionStart: () =>
      dash.startCalibrationLed(
        CALIBRATION_LED.FOCUS_APERTURE.pattern,
        CALIBRATION_LED.FOCUS_APERTURE.color
      ),
    onSessionEnd: () => {
      dash.completeWorkflowStep(CAMERA_WORKFLOW_STEP_IDS.CAL_FOCUS);
      dash.finishCalibrationLed(
        CALIBRATION_LED.FOCUS_APERTURE_DONE.pattern,
        CALIBRATION_LED.FOCUS_APERTURE_DONE.color
      );
    },
    onExposureChange: (ms) => dash.setOpticalExposureMs(ms),
  });

  const statusTone =
    optical.statusText && optical.statusText.toLowerCase().includes("error")
      ? "text-red-700"
      : optical.commandPending
        ? "text-amber-700"
        : "text-slate-700";

  return (
    <div className="space-y-4">
      <Card title="Calibración de enfoque y diafragma">
        {optical.cameraInfo ? (
          <dl className="mb-4 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-xs sm:grid-cols-4">
            <div>
              <dt className="text-[10px] uppercase text-slate-500">Cámara</dt>
              <dd className="text-slate-800">{optical.cameraInfo.camera_id ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase text-slate-500">Estado</dt>
              <dd className="text-emerald-700">{optical.cameraInfo.state ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase text-slate-500">Filtro</dt>
              <dd className="text-slate-800">
                {optical.cameraInfo.current_filter_nm != null
                  ? `${optical.cameraInfo.current_filter_nm} nm`
                  : optical.activeFilter.label}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase text-slate-500">Ocupada</dt>
              <dd>{optical.cameraInfo.busy ? "sí" : "no"}</dd>
            </div>
          </dl>
        ) : null}

        {!optical.sessionActive ? (
          <div className="mb-4 flex flex-col items-start gap-1.5">
            <button
              type="button"
              disabled={optical.controlsDisabled || !optical.connected}
              onClick={optical.startOpticalCalibration}
              className="rounded-xl bg-emerald-600 px-5 py-2.5 font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Iniciar calibración
            </button>
            {!optical.connected ? (
              <div className="flex items-center gap-2 pl-1 text-[11px]">
                <span className="font-medium text-red-700">
                  Cámara sin conexión
                </span>
                <button
                  type="button"
                  onClick={optical.reconnect}
                  className="font-semibold text-red-700 underline underline-offset-2 hover:no-underline"
                >
                  Reintentar
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[11px] uppercase text-slate-500">
              Exposición (ms)
            </span>
            <input
              type="number"
              min="1"
              value={optical.exposureMs}
              onChange={(e) => optical.setExposureMs(e.target.value)}
              disabled={!optical.sessionActive || optical.controlsDisabled}
              className="w-28 rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-sm disabled:bg-slate-100"
            />
          </label>
          <button
            type="button"
            disabled={!optical.sessionActive || optical.controlsDisabled}
            onClick={optical.applyExposure}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
          >
            Aplicar exposición
          </button>

          {optical.sessionActive ? (
            <button
              type="button"
              disabled={optical.controlsDisabled}
              onClick={optical.finishOpticalCalibration}
              className="ml-auto rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900 shadow-sm hover:bg-emerald-100 disabled:opacity-50"
            >
              Terminar calibración
            </button>
          ) : null}
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Filtro activo
          </span>
          <div className="flex flex-wrap gap-2">
            {WAVELENGTH_FILTERS.map((w) => (
              <button
                key={w.id}
                type="button"
                disabled={!optical.sessionActive || optical.controlsDisabled}
                onClick={() => optical.moveFilter(w.id)}
                className={`rounded-full border px-3 py-1.5 font-mono text-xs transition disabled:opacity-40 ${
                  (optical.cameraInfo?.current_filter_id ?? optical.selectedFilterId) ===
                  w.id
                    ? "border-emerald-500 bg-emerald-50 text-emerald-900 shadow-sm ring-1 ring-emerald-200"
                    : "border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:bg-slate-50"
                }`}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>

        {optical.statusText ? (
          <p className={`mb-4 text-sm font-medium ${statusTone}`}>{optical.statusText}</p>
        ) : null}

        <OpticalLiveView
          frameUrl={optical.frameUrl}
          livePaused={optical.livePaused}
          switchingFilter={optical.switchingFilter}
          blanked={optical.liveViewBlanked}
          waiting={optical.sessionActive && !optical.frameUrl && !optical.liveViewBlanked}
          placeholder={
            optical.sessionActive
              ? "Esperando fotogramas de la cámara…"
              : "Inicia la calibración óptica para ver la vista en vivo."
          }
        />
      </Card>
    </div>
  );
}

function PanelCaptureSingle({ dash }) {
  const [name, setName] = useState("rancho_lado_norte_1");

  const capture = useCubeCaptureMode({
    appendLog: dash.appendLog,
    activeWhiteReference: dash.activeWhiteReference,
    opticalExposureMs: dash.opticalExposureMs,
    onCaptureSuccess: () =>
      dash.completeWorkflowStep(CAMERA_WORKFLOW_STEP_IDS.CAPTURE),
  });

  const phase = capture.capturingCube
    ? "capturing"
    : capture.commandPending && capture.activeCommandName === "capture_cube"
      ? "capturing"
      : capture.lastCaptureOk
        ? "success"
        : capture.modeActive
          ? "ready"
          : capture.isStarting
            ? "starting"
            : "idle";

  const statusTone =
    capture.connectionError || capture.statusText?.toLowerCase().includes("error")
      ? "text-red-700"
      : capture.commandPending || capture.capturingCube
        ? "text-amber-700"
        : "text-slate-700";

  const runCapture = useCallback(() => {
    if (!capture.canCapture) {
      dash.appendLog("[ERR] Define calibración de blancos antes de capturar el cubo.");
      return;
    }
    capture.captureCube(name);
  }, [capture, name, dash]);

  // Al entrar al apartado, si la cámara está online y el modo captura ya está
  // activo, posiciona automáticamente el filtro de 450 nm (una sola vez por
  // entrada). Si el usuario cambia el filtro después, no se vuelve a forzar.
  const autoFilterDoneRef = useRef(false);
  useEffect(() => {
    if (autoFilterDoneRef.current) return;
    if (!capture.connected || !capture.modeActive || capture.controlsDisabled) {
      return;
    }
    const filter450 = WAVELENGTH_FILTERS.find((w) => w.nm === 450);
    if (!filter450) return;
    autoFilterDoneRef.current = true;
    capture.moveFilter(filter450.id);
  }, [capture.connected, capture.modeActive, capture.controlsDisabled, capture]);

  return (
    <div className="space-y-4 pb-24">
      <Card title="Captura de cubo">
        {capture.startFailed && capture.startError ? (
          <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            No se pudo activar el modo captura: <strong>{capture.startError}</strong>
            <button
              type="button"
              onClick={capture.retryStartMode}
              disabled={capture.isStarting}
              className="ml-2 font-semibold underline disabled:opacity-50"
            >
              Reintentar modo captura
            </button>
          </p>
        ) : null}

        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
              Exposición (ms)
            </span>
            <input
              type="number"
              min="1"
              value={capture.exposureMs}
              onChange={(e) => capture.setExposureMs(e.target.value)}
              disabled={capture.controlsDisabled}
              className="w-28 rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-sm disabled:bg-slate-100"
            />
          </label>
          <button
            type="button"
            disabled={capture.controlsDisabled}
            onClick={capture.applyExposure}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
          >
            Aplicar exposición
          </button>
          {capture.modeActive ? (
            <button
              type="button"
              disabled={capture.commandPending || capture.capturingCube}
              onClick={capture.exitCaptureMode}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
            >
              Salir del modo captura
            </button>
          ) : null}
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Filtro preview
          </span>
          <div className="flex flex-wrap gap-2">
            {WAVELENGTH_FILTERS.map((w) => (
              <button
                key={w.id}
                type="button"
                disabled={capture.controlsDisabled}
                onClick={() => capture.moveFilter(w.id)}
                className={`rounded-full border px-3 py-1.5 font-mono text-xs transition disabled:opacity-40 ${
                  (capture.cameraInfo?.current_filter_id ?? capture.selectedFilterId) === w.id
                    ? "border-emerald-500 bg-emerald-50 text-emerald-900 shadow-sm ring-1 ring-emerald-200"
                    : "border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:bg-slate-50"
                }`}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>

        {capture.statusText ? (
          <p className={`mb-4 text-sm font-medium ${statusTone}`}>{capture.statusText}</p>
        ) : null}

        <OpticalLiveView
          frameUrl={capture.frameUrl}
          livePaused={capture.livePaused}
          switchingFilter={capture.switchingFilter}
          capturingCube={capture.capturingCube}
          waiting={capture.modeActive && !capture.frameUrl}
          placeholder={
            capture.modeActive
              ? "Esperando vista en vivo del modo captura…"
              : capture.isStarting
                ? "Activando modo captura de cubo…"
                : "Esperando conexión con la cámara…"
          }
        />
      </Card>

      <Card title="Guardar como">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
            Nombre de captura
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={capture.capturingCube || capture.commandPending}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 disabled:bg-slate-100"
          />
        </label>
        <h3 className="mt-5 font-mono text-[11px] uppercase tracking-wider text-slate-500">
          Parámetros de este cubo
        </h3>
        <dl className="mt-1 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-600">
          <div className="flex justify-between gap-4">
            <dt>Referencia blanca</dt>
            <dd className={dash.activeWhiteReference ? "text-emerald-700" : "text-amber-700"}>
              {dash.activeWhiteReference?.cube_id ?? "sin definir"}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Filtro activo</dt>
            <dd className="text-emerald-700">{capture.activeFilter.label}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Estado</dt>
            <dd className="uppercase text-emerald-700">{phase}</dd>
          </div>
        </dl>
      </Card>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-md lg:sticky lg:bottom-auto lg:z-0 lg:border-t-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-2">
          <p className="font-mono text-[11px] text-slate-500">
            Fase: <span className="text-emerald-700">{phase}</span>
            {capture.capturingCube ? (
              <span className="ml-2 text-amber-700">· Capturing cube…</span>
            ) : null}
          </p>
          <button
            type="button"
            onClick={runCapture}
            disabled={
              capture.commandPending ||
              capture.capturingCube ||
              !capture.canCapture ||
              !capture.modeActive ||
              !capture.connected
            }
            className="rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 px-10 py-4 text-lg font-bold tracking-wide text-white shadow-[0_0_24px_rgba(16,185,129,0.35)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {capture.commandPending || capture.capturingCube ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Capturando…
              </span>
            ) : (
              "Capturar cubo"
            )}
          </button>
          {!capture.connected ? (
            <div className="flex items-center gap-2 text-[11px]">
              <span className="font-medium text-red-700">
                Cámara sin conexión
              </span>
              <button
                type="button"
                onClick={capture.reconnect}
                className="font-semibold text-red-700 underline underline-offset-2 hover:no-underline"
              >
                Reintentar
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PanelCaptureContinuous({ dash }) {
  const [mission, setMission] = useState("idle");
  const [elapsed, setElapsed] = useState(0);
  const [cubes, setCubes] = useState(0);
  const [events, setEvents] = useState([]);
  const [name, setName] = useState("secuencia_estufa_A12");
  const [exp, setExp] = useState("14");
  const [intervalSec, setIntervalSec] = useState("8");

  const intervalMs = Math.max(500, Number.parseFloat(intervalSec) * 1000 || 8000);

  useEffect(() => {
    if (cubes >= 1) {
      dash.completeWorkflowStep(CAMERA_WORKFLOW_STEP_IDS.CAPTURE);
    }
  }, [cubes, dash.completeWorkflowStep]);

  useEffect(() => {
    if (mission !== "running") return;
    const t0 = Date.now();
    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - t0) / 1000));
    }, 500);
    return () => window.clearInterval(id);
  }, [mission]);

  useEffect(() => {
    if (mission !== "running") return;
    const id = window.setInterval(() => {
      setCubes((c) => {
        const next = c + 1;
        const label = new Date().toLocaleTimeString("es", { hour12: false });
        setEvents((ev) =>
          [
            {
              t: label,
              msg: `Cubo #${next} · ${name} · ${exp} ms (mock)`,
            },
            ...ev,
          ].slice(0, 12)
        );
        dash.appendLog(
          `[CAPTURE] Secuencia · cubo ${next} · ${name} · exposición ${exp} ms`
        );
        return next;
      });
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [mission, dash, intervalMs, name, exp]);

  return (
    <div className="space-y-4">
      <Card title="Parámetros de captura" subtitle="Nombre y exposición de la secuencia">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
              Nombre de captura
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={mission === "running"}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 disabled:bg-slate-100 disabled:text-slate-500"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
              Tiempo de exposición (ms)
            </span>
            <input
              type="number"
              value={exp}
              onChange={(e) => setExp(e.target.value)}
              disabled={mission === "running"}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 disabled:bg-slate-100 disabled:text-slate-500"
            />
          </label>
        </div>
      </Card>

      <Card title="Secuencia" subtitle="Intervalo entre capturas y control de misión.">
        <label className="mb-4 flex max-w-xs flex-col gap-1">
          <span className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
            Intervalo entre capturas (s)
          </span>
          <input
            type="number"
            min="0.5"
            step="0.5"
            value={intervalSec}
            onChange={(e) => setIntervalSec(e.target.value)}
            disabled={mission === "running"}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 disabled:bg-slate-100 disabled:text-slate-500"
          />
        </label>
        <div className="grid gap-4 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 lg:col-span-1">
            <p className="font-mono text-[10px] uppercase text-slate-500">Tiempo total</p>
            <p className="mt-1 font-mono text-3xl text-emerald-600">
              {Math.floor(elapsed / 60)
                .toString()
                .padStart(2, "0")}
              :{(elapsed % 60).toString().padStart(2, "0")}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="font-mono text-[10px] uppercase text-slate-500">Cubos</p>
            <p className="mt-1 font-mono text-3xl text-emerald-400">{cubes}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="font-mono text-[10px] uppercase text-slate-500">Intervalo</p>
            <p className="mt-1 font-mono text-xl text-slate-800">{intervalSec} s</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="font-mono text-[10px] uppercase text-slate-500">Estado misión</p>
            <p className="mt-1 font-mono text-lg uppercase text-amber-300">{mission}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setMission("running");
              dash.appendLog("[MISSION] Secuencia iniciada (mock).");
            }}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Iniciar
          </button>
          <button
            type="button"
            onClick={() => {
              setMission("paused");
              dash.appendLog("[MISSION] Pausa (mock).");
            }}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-800 shadow-sm hover:bg-slate-50"
          >
            Pausa
          </button>
          <button
            type="button"
            onClick={() => {
              setMission("running");
              dash.appendLog("[MISSION] Continuar (mock).");
            }}
            className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm text-emerald-900"
          >
            Continuar
          </button>
          <button
            type="button"
            onClick={() => {
              setMission("idle");
              setElapsed(0);
              setCubes(0);
              setEvents([]);
              dash.appendLog("[MISSION] Terminar y reiniciar contadores (mock).");
            }}
            className="rounded-xl border border-red-800 bg-red-950/40 px-4 py-2 text-sm text-red-200"
          >
            Terminar
          </button>
        </div>
        <div className="mt-6">
          <p className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
            Actividad reciente
          </p>
          <ul className="mt-2 space-y-2">
            {events.length === 0 ? (
              <li className="text-sm text-slate-600">Sin eventos hasta iniciar misión.</li>
            ) : (
              events.map((e, i) => (
                <li
                  key={`${e.t}-${i}`}
                  className="flex gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-700"
                >
                  <span className="text-slate-500">{e.t}</span>
                  <span>{e.msg}</span>
                </li>
              ))
            )}
          </ul>
        </div>
      </Card>
    </div>
  );
}

function PanelLeds({ dash }) {
  const { ledPattern, setLedPattern, ledColor, setLedColor } = dash;
  return (
    <div className="space-y-4">
      <Card title="Sistema visual · NeoPixel" subtitle="Patrones y colores · solo representación UI.">
        <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-start lg:justify-between">
          <NeoPixelRing pattern={ledPattern} colorKey={ledColor} size={160} />
          <div className="flex w-full max-w-md flex-col gap-4">
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[11px] text-slate-500">Patrón</span>
              <select
                value={ledPattern}
                onChange={(e) => {
                  setLedPattern(e.target.value);
                  dash.appendLog(`[LED] Patrón → ${e.target.value}`);
                }}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900"
              >
                <option value="spinner">Spinner</option>
                <option value="blink">Blink</option>
                <option value="doubleFlash">DoubleFlash</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[11px] text-slate-500">Color</span>
              <select
                value={ledColor}
                onChange={(e) => {
                  setLedColor(e.target.value);
                  dash.appendLog(`[LED] Color → ${e.target.value}`);
                }}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900"
              >
                <option value="emerald">Esmeralda</option>
                <option value="cyan">Cyan</option>
                <option value="green">Verde</option>
                <option value="red">Rojo</option>
                <option value="blue">Azul</option>
                <option value="yellow">Amarillo</option>
                <option value="white">Blanco</option>
              </select>
            </label>
          </div>
        </div>
      </Card>
    </div>
  );
}

function PanelLogs({ dash }) {
  return (
    <Card title="Consola extendida" subtitle="Misma fuente de logs que la cabecera + scroll.">
      <CameraLogConsole ref={dash.logScrollRef} lines={dash.logs} className="min-h-[360px]" />
      <button
        type="button"
        className="mt-3 rounded-lg border border-slate-300 px-3 py-1.5 font-mono text-xs text-slate-600 hover:bg-slate-100"
        onClick={() =>
          dash.appendLog("[INFO] Entrada manual de prueba desde panel de logs.")
        }
      >
        Añadir log de prueba
      </button>
    </Card>
  );
}

export default function CameraSectionPanels({ section, dash }) {
  switch (section) {
    case CAMERA_SECTION_IDS.CONFIG:
      return <PanelConfig dash={dash} />;
    case CAMERA_SECTION_IDS.CAL_FILTERS:
      return <PanelCalFilters dash={dash} />;
    case CAMERA_SECTION_IDS.CAL_FOCUS_APERTURE:
      return <PanelCalFocusAperture dash={dash} />;
    case CAMERA_SECTION_IDS.CAL_WHITE:
      return <PanelCalWhite dash={dash} />;
    case CAMERA_SECTION_IDS.CAPTURE_SINGLE:
      return <PanelCaptureSingle dash={dash} />;
    case CAMERA_SECTION_IDS.CAPTURE_CONTINUOUS:
      return <PanelCaptureContinuous dash={dash} />;
    case CAMERA_SECTION_IDS.LEDS:
      return <PanelLeds dash={dash} />;
    case CAMERA_SECTION_IDS.LOGS:
      return <PanelLogs dash={dash} />;
    default:
      return <PanelConfig dash={dash} />;
  }
}
