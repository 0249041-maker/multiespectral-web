import CameraLogConsole from "@/components/camera/CameraLogConsole.jsx";
import ScientificLiveView from "@/components/camera/ScientificLiveView.jsx";
import FocusLiveTest from "@/components/FocusLiveTest.jsx";
import NeoPixelRing from "@/components/camera/NeoPixelRing.jsx";
import {
  CALIBRATION_LED,
  CAMERA_LIVE_WS_URL,
  CAMERA_SECTION_IDS,
  WAVELENGTH_FILTERS,
} from "@/lib/cameraDashboardConstants";
import { useFilterCalibration } from "@/hooks/useFilterCalibration";
import { useCallback, useEffect, useMemo, useState } from "react";

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

function PanelStatus() {
  const metrics = useMemo(
    () => [
      { label: "CPU π", value: "34 %", tone: "text-emerald-700" },
      { label: "Temp. SoC", value: "48 °C", tone: "text-emerald-300" },
      { label: "RAM", value: "2.1 / 8 GB", tone: "text-slate-200" },
      { label: "NVMe", value: "62 % usado", tone: "text-amber-200" },
    ],
    []
  );

  return (
    <div className="space-y-4">
      <Card
        title="Estado del instrumento"
        subtitle="Resumen operativo simulado · Raspberry Pi 5 + MVSDK"
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((m) => (
            <div
              key={m.label}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
            >
              <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                {m.label}
              </p>
              <p className={`mt-1 font-mono text-lg ${m.tone}`}>{m.value}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 lg:col-span-2">
            <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
              Throughput de cubos (mock)
            </p>
            <div className="mt-3 flex h-28 items-end gap-1">
              {[42, 58, 51, 63, 49, 71, 66, 74, 69, 78, 72, 80].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t bg-gradient-to-t from-emerald-600/40 to-emerald-400/90 shadow-[0_0_10px_rgba(16,185,129,0.2)] transition-all"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4">
            <p className="font-mono text-[10px] uppercase tracking-wider text-emerald-800">
              Enlace de campo
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Calidad del enlace y colas de subida se mostrarán aquí cuando el backend
              reporte telemetría real.
            </p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full w-[73%] animate-pulse rounded-full bg-gradient-to-r from-emerald-500 to-teal-400" />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function PanelConfig({ dash }) {
  const [networks, setNetworks] = useState([
    { ssid: "Lab_Field_NIR", signal: 78 },
    { ssid: "Greenhouse_5G", signal: 64 },
  ]);

  const appendLog = dash.appendLog;

  return (
    <Card title="Redes WiFi guardadas" subtitle="Gestión local simulada (sin backend).">
      <ul className="space-y-2">
        {networks.map((n, idx) => (
          <li
            key={n.ssid}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
          >
            <span className="font-mono text-sm text-slate-800">{n.ssid}</span>
            <span className="font-mono text-xs text-slate-500">{n.signal}% señal</span>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
                onClick={() => appendLog(`[UI] Editar contraseña (mock) · ${n.ssid}`)}
              >
                Editar
              </button>
              <button
                type="button"
                className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                onClick={() => {
                  setNetworks((prev) => prev.filter((_, i) => i !== idx));
                  appendLog(`[UI] Red eliminada (mock) · ${n.ssid}`);
                }}
              >
                Eliminar
              </button>
            </div>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="mt-3 rounded-xl border border-dashed border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-900 hover:bg-emerald-100"
        onClick={() => {
          const id = `nueva_red_${networks.length + 1}`;
          setNetworks((p) => [...p, { ssid: id, signal: 55 }]);
          appendLog(`[UI] Agregar red (mock) · ${id}`);
        }}
      >
        + Agregar red
      </button>
    </Card>
  );
}

function PanelCalFilters({ dash }) {
  const cal = useFilterCalibration({
    wsUrl: CAMERA_LIVE_WS_URL,
    appendLog: dash.appendLog,
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
    <Card
      title="Calibración de filtros"
      subtitle="Comando WebSocket calibrate_filters · solo mensajes JSON."
    >
      <p className="mb-3 font-mono text-xs text-slate-500">
        WebSocket:{" "}
        <code className="rounded bg-slate-100 px-1 text-emerald-800">{cal.wsUrl}</code>
        <span className="ml-2">
          ·{" "}
          <span className={cal.connected ? "text-emerald-600" : "text-amber-600"}>
            {cal.connected ? "conectado" : "desconectado"}
          </span>
        </span>
      </p>

      {cal.connectionError ? (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {cal.connectionError}
          <button
            type="button"
            onClick={cal.reconnect}
            className="ml-2 underline hover:no-underline"
          >
            Reintentar
          </button>
        </p>
      ) : null}

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

      <button
        type="button"
        disabled={cal.buttonDisabled}
        onClick={() => {
          dash.startCalibrationLed(
            CALIBRATION_LED.FILTERS.pattern,
            CALIBRATION_LED.FILTERS.color
          );
          cal.startCalibration();
        }}
        className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 font-semibold text-white shadow-[0_0_20px_rgba(16,185,129,0.25)] transition hover:brightness-110 disabled:opacity-50"
      >
        {cal.isCalibrating ? "Calibrando…" : "Iniciar calibración"}
      </button>

      {cal.statusText ? (
        <p className={`mt-4 text-sm font-medium ${statusTone}`}>{cal.statusText}</p>
      ) : (
        <p className="mt-4 text-sm text-slate-500">
          Pulsa el botón para enviar el comando de calibración del cubo de filtros.
        </p>
      )}

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
  const [wl, setWl] = useState(550);
  const activeFilter = WAVELENGTH_FILTERS.find((w) => w.nm === wl) ?? WAVELENGTH_FILTERS[1];
  const bars = useMemo(() => Array.from({ length: 24 }, () => 20 + Math.random() * 75), [wl]);

  return (
    <div className="space-y-4">
      <Card
        title="Calibración de enfoque y diafragma"
        subtitle="Mismo flujo: ajusta el filtro activo, observa la vista en vivo y confirma cuando termines."
      >
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Filtro activo
          </span>
          <div className="flex flex-wrap gap-2">
            {WAVELENGTH_FILTERS.map((w) => (
              <button
                key={w.nm}
                type="button"
                onClick={() => {
                  setWl(w.nm);
                  dash.appendLog(
                    `[CAL] Enfoque/diafragma · filtro ${w.label} seleccionado.`
                  );
                }}
                className={`rounded-full border px-3 py-1.5 font-mono text-xs transition ${
                  wl === w.nm
                    ? "border-emerald-500 bg-emerald-50 text-emerald-900 shadow-sm ring-1 ring-emerald-200"
                    : "border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:bg-slate-50"
                }`}
              >
                {w.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() =>
              dash.appendLog("[CAL] Terminar calibración enfoque y diafragma (mock).")
            }
            className="ml-auto rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900 shadow-sm hover:bg-emerald-100"
          >
            Terminar calibración
          </button>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <FocusLiveTest
              embedded
              fixedWsUrl={CAMERA_LIVE_WS_URL}
              title="Vista en vivo"
              subtitle={`Ajusta enfoque y diafragma con el filtro ${activeFilter.label} activo.`}
              showHelp={false}
              startButtonLabel="Iniciar calibración"
              onCalibrationStart={() =>
                dash.startCalibrationLed(
                  CALIBRATION_LED.FOCUS_APERTURE.pattern,
                  CALIBRATION_LED.FOCUS_APERTURE.color
                )
              }
            />
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
              Histograma · {activeFilter.label}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Referencia visual mientras calibras (mock hasta conectar telemetría real).
            </p>
            <div className="mt-3 flex h-40 items-end gap-0.5">
              {bars.map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t bg-gradient-to-t from-slate-300 to-emerald-500/80"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
            <dl className="mt-4 space-y-2 font-mono text-xs text-slate-600">
              <div className="flex justify-between">
                <dt>Exposición objetivo</dt>
                <dd className="text-emerald-700">{(wl / 42).toFixed(1)} ms</dd>
              </div>
              <div className="flex justify-between">
                <dt>Enfoque</dt>
                <dd className="text-slate-500">manual</dd>
              </div>
              <div className="flex justify-between">
                <dt>Diafragma</dt>
                <dd className="text-slate-500">por filtro</dd>
              </div>
            </dl>
          </div>
        </div>
      </Card>
    </div>
  );
}

function PanelCalWhite({ dash }) {
  const [phase, setPhase] = useState("idle");
  const [liveStarted, setLiveStarted] = useState(false);

  const run = () => {
    setPhase("capturing");
    dash.appendLog("[CAPTURE] Blancos · capturando placas…");
    window.setTimeout(() => {
      setPhase("processing");
      dash.appendLog("[PROC] Compensación espectral…");
    }, 900);
    window.setTimeout(() => {
      setPhase("uploading");
      dash.appendLog("[UPLOAD] Subiendo coeficientes (mock)…");
    }, 1800);
    window.setTimeout(() => {
      setPhase("idle");
      dash.appendLog("[OK] Compensadores aplicados (mock).");
    }, 2600);
  };

  return (
    <Card
      title="Calibración de compensadores blancos"
      subtitle="Inicia la calibración para ver la cámara en vivo, luego captura los compensadores."
    >
      <div className="flex flex-wrap items-center gap-3">
        {!liveStarted ? (
          <button
            type="button"
            onClick={() => {
              setLiveStarted(true);
              dash.startCalibrationLed(
                CALIBRATION_LED.WHITE.pattern,
                CALIBRATION_LED.WHITE.color
              );
              dash.appendLog("[CAL] Compensadores blancos · iniciando vista en vivo…");
            }}
            className="rounded-xl bg-emerald-600 px-5 py-2.5 font-semibold text-white shadow-sm hover:bg-emerald-700"
          >
            Iniciar calibración
          </button>
        ) : null}
        <button
          type="button"
          onClick={run}
          disabled={!liveStarted || phase !== "idle"}
          className="rounded-xl bg-gradient-to-r from-violet-600 to-emerald-600 px-5 py-2.5 font-semibold text-white shadow-lg disabled:opacity-40"
        >
          Capturar compensadores
        </button>
      </div>

      {liveStarted ? (
        <div className="mt-4">
          <FocusLiveTest
            embedded
            fixedWsUrl={CAMERA_LIVE_WS_URL}
            autoStart
            hideStartButton
            hideHeader
            showHelp={false}
            title=""
            subtitle=""
            startButtonLabel="Iniciar calibración"
            stopButtonLabel="Detener calibración"
            onCalibrationStart={() =>
              dash.startCalibrationLed(
                CALIBRATION_LED.WHITE.pattern,
                CALIBRATION_LED.WHITE.color
              )
            }
          />
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          Pulsa «Iniciar calibración» para conectar la vista en vivo de la cámara.
        </p>
      )}

      <dl className="mt-4 grid gap-2 font-mono text-sm sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <dt className="text-[10px] uppercase text-slate-500">Captura</dt>
          <dd className="text-emerald-700">{phase === "capturing" ? "activa" : "idle"}</dd>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <dt className="text-[10px] uppercase text-slate-500">Procesamiento</dt>
          <dd className="text-amber-700">{phase === "processing" ? "en curso" : "—"}</dd>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <dt className="text-[10px] uppercase text-slate-500">Subida</dt>
          <dd className="text-violet-700">{phase === "uploading" ? "subiendo" : "—"}</dd>
        </div>
      </dl>
    </Card>
  );
}

function PanelCaptureSingle({ dash }) {
  const [phase, setPhase] = useState("idle");
  const [name, setName] = useState("cubo_estufa_A12");
  const [filt, setFilt] = useState("650 nm");
  const [exp, setExp] = useState("14");

  const capture = useCallback(() => {
    setPhase("capturing");
    dash.appendLog("[CAPTURE] Capturando cubo multiespectral…");
    window.setTimeout(() => {
      setPhase("uploading");
      dash.appendLog("[UPLOAD] Cubo → almacenamiento…");
    }, 1100);
    window.setTimeout(() => {
      setPhase("success");
      dash.appendLog("[OK] Cubo registrado (mock).");
    }, 2200);
    window.setTimeout(() => setPhase("idle"), 4200);
  }, [dash]);

  return (
    <div className="space-y-4 pb-24">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Adquisición en vivo" subtitle="Panel izquierdo · vista técnica">
          <ScientificLiveView filterLabel={filt} />
          <label className="mt-4 flex flex-col gap-1">
            <span className="font-mono text-[11px] text-slate-500">Filtro</span>
            <select
              value={filt}
              onChange={(e) => setFilt(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-sm"
            >
              {WAVELENGTH_FILTERS.map((w) => (
                <option key={w.nm} value={w.label}>
                  {w.label}
                </option>
              ))}
            </select>
          </label>
        </Card>
        <Card title="Parámetros de captura" subtitle="Nombre y exposición de este cubo">
          <div className="grid gap-4">
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
                Nombre de captura
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
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
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
              />
            </label>
          </div>
          <dl className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-400">
            <div className="flex justify-between">
              <dt>UUID sesión</dt>
              <dd className="text-emerald-700">mxc-7f3a·mock</dd>
            </div>
            <div className="flex justify-between">
              <dt>Band pack</dt>
              <dd>5 bandas · RAW + JPEG</dd>
            </div>
            <div className="flex justify-between">
              <dt>Estado</dt>
              <dd className="uppercase text-emerald-400">{phase}</dd>
            </div>
          </dl>
        </Card>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-md lg:sticky lg:bottom-auto lg:z-0 lg:border-t-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none">
        <div className="mx-auto flex max-w-7xl flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="font-mono text-[11px] text-slate-500">
            Fase: <span className="text-emerald-700">{phase}</span>
          </div>
          <button
            type="button"
            onClick={capture}
            disabled={phase === "capturing" || phase === "uploading"}
            className="rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 px-10 py-4 text-lg font-bold tracking-wide text-white shadow-[0_0_24px_rgba(16,185,129,0.35)] transition hover:brightness-110 disabled:opacity-40"
          >
            {phase === "capturing" || phase === "uploading" ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Procesando…
              </span>
            ) : (
              "Capturar cubo"
            )}
          </button>
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

function PanelLive() {
  return (
    <div className="space-y-4">
      <FocusLiveTest
        fixedWsUrl={CAMERA_LIVE_WS_URL}
        title="Vista en vivo"
        subtitle="Stream JPEG de la cámara multiespectral en tiempo real."
        showHelp
      />
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
    case CAMERA_SECTION_IDS.STATUS:
      return <PanelStatus />;
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
    case CAMERA_SECTION_IDS.LIVE:
      return <PanelLive />;
    case CAMERA_SECTION_IDS.LEDS:
      return <PanelLeds dash={dash} />;
    case CAMERA_SECTION_IDS.LOGS:
      return <PanelLogs dash={dash} />;
    default:
      return <PanelStatus />;
  }
}
