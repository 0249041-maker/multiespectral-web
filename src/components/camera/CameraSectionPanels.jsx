import CameraLogConsole from "@/components/camera/CameraLogConsole.jsx";
import ScientificLiveView from "@/components/camera/ScientificLiveView.jsx";
import FocusLiveTest from "@/components/FocusLiveTest.jsx";
import NeoPixelRing from "@/components/camera/NeoPixelRing.jsx";
import {
  CAMERA_SECTION_IDS,
  WAVELENGTH_FILTERS,
} from "@/lib/cameraDashboardConstants";
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
  const [exposure, setExposure] = useState("12");
  const [captureName, setCaptureName] = useState("captura_{fecha}_{filtro}");
  const [resolution, setResolution] = useState("2464×2056");
  const [intervalSec, setIntervalSec] = useState("8");
  const [streamQ, setStreamQ] = useState("85");
  const [debug, setDebug] = useState(false);
  const [autoReconnect, setAutoReconnect] = useState(true);
  const [autoUpload, setAutoUpload] = useState(true);

  const appendLog = dash.appendLog;

  return (
    <div className="space-y-4">
      <Card title="Redes WiFi guardadas" subtitle="Gestión local simulada (sin backend).">
        <ul className="space-y-2">
          {networks.map((n, idx) => (
            <li
              key={n.ssid}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
            >
              <span className="font-mono text-sm text-slate-200">{n.ssid}</span>
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
                  className="rounded-lg border border-red-900/60 px-2 py-1 text-xs text-red-300 hover:bg-red-950/50"
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

      <Card title="Parámetros generales" subtitle="Formulario de hardware · valores no persistidos.">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
              Tiempo de exposición (ms)
            </span>
            <input
              type="number"
              value={exposure}
              onChange={(e) => setExposure(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
              Nombre por defecto de captura
            </span>
            <input
              type="text"
              value={captureName}
              onChange={(e) => setCaptureName(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
              Resolución
            </span>
            <select
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
            >
              <option>2464×2056</option>
              <option>2048×1536</option>
              <option>1920×1080</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
              Intervalo entre capturas (s)
            </span>
            <input
              type="number"
              value={intervalSec}
              onChange={(e) => setIntervalSec(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
            />
          </label>
          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
              Calidad de stream (%)
            </span>
            <input
              type="range"
              min="40"
              max="100"
              value={streamQ}
              onChange={(e) => setStreamQ(e.target.value)}
              className="accent-emerald-500"
            />
            <span className="font-mono text-xs text-slate-400">{streamQ}%</span>
          </label>
        </div>
      </Card>

      <Card title="Configuración avanzada">
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap">
          {[
            ["Modo debug", debug, setDebug],
            ["Auto reconnect", autoReconnect, setAutoReconnect],
            ["Subida automática", autoUpload, setAutoUpload],
          ].map(([label, val, set]) => (
            <label
              key={label}
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
            >
              <input
                type="checkbox"
                checked={val}
                onChange={(e) => {
                  set(e.target.checked);
                  appendLog(`[CFG] ${label} → ${e.target.checked ? "on" : "off"} (mock)`);
                }}
                className="h-4 w-4 rounded border-slate-300 bg-white text-emerald-600 focus:ring-emerald-500/40"
              />
              <span className="text-sm text-slate-700">{label}</span>
            </label>
          ))}
        </div>
      </Card>
    </div>
  );
}

function PanelCalFilters({ dash }) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          setRunning(false);
          dash.appendLog("[OK] Calibración de filtros completada (mock).");
          return 100;
        }
        const next = Math.min(100, p + 7 + Math.random() * 6);
        if (next > 30 && p <= 30) setLogs((l) => [...l, "[CAL] Normalizando respuesta espectral…"]);
        if (next > 70 && p <= 70) setLogs((l) => [...l, "[CAL] Verificando bandas NIR…"]);
        return next;
      });
    }, 320);
    return () => window.clearInterval(id);
  }, [running, dash]);

  return (
    <Card title="Calibración de filtros" subtitle="Secuencia automática simulada con barra de progreso.">
      <button
        type="button"
        disabled={running}
        onClick={() => {
          setProgress(0);
          setLogs(["[CAL] Inicio de rutina de filtros…"]);
          setRunning(true);
          dash.appendLog("[CAPTURE] Calibración filtros · run mock");
        }}
        className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 font-semibold text-white shadow-[0_0_20px_rgba(16,185,129,0.25)] transition hover:brightness-110 disabled:opacity-50"
      >
        Iniciar calibración
      </button>
      <div className="mt-4">
        <div className="mb-1 flex justify-between font-mono text-[11px] text-slate-500">
          <span>Progreso</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      <div className="mt-4 rounded-xl border border-slate-200 bg-black/40 p-3 font-mono text-[11px] text-slate-400">
        {logs.map((l, i) => (
          <p key={`${i}-${l}`}>{l}</p>
        ))}
      </div>
    </Card>
  );
}

function PanelCalFocus({ dash }) {
  const [filter, setFilter] = useState("550 nm");
  return (
    <div className="space-y-4">
      <Card title="Calibración de enfoque" subtitle="Vista técnica simulada + enlace WebSocket opcional.">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-slate-500">Filtro activo</span>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1 font-mono text-sm text-emerald-800"
          >
            {WAVELENGTH_FILTERS.map((w) => (
              <option key={w.nm} value={w.label}>
                {w.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => dash.appendLog("[CAL] Terminar calibración enfoque (mock).")}
            className="ml-auto rounded-xl border border-emerald-500/40 bg-emerald-950/40 px-4 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-950/70"
          >
            Terminar calibración
          </button>
        </div>
        <ScientificLiveView filterLabel={filter} />
      </Card>
      <details className="rounded-2xl border border-slate-200 bg-slate-50">
        <summary className="cursor-pointer px-4 py-3 font-mono text-sm text-slate-600 hover:text-slate-900">
          Conexión WebSocket experimental (hardware real)
        </summary>
        <div className="border-t border-slate-200 p-4 [&_*]:max-w-none">
          <FocusLiveTest />
        </div>
      </details>
    </div>
  );
}

function PanelCalAperture({ dash }) {
  const [wl, setWl] = useState(550);
  const bars = useMemo(() => Array.from({ length: 24 }, () => 20 + Math.random() * 75), [wl]);

  return (
    <Card title="Calibración de diafragma" subtitle="Selector de banda + vista mock + histograma decorativo.">
      <div className="flex flex-wrap gap-2">
        {WAVELENGTH_FILTERS.map((w) => (
          <button
            key={w.nm}
            type="button"
            onClick={() => {
              setWl(w.nm);
              dash.appendLog(`[CAL] Diafragma · filtro ${w.label} seleccionado (mock).`);
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
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ScientificLiveView filterLabel={`${wl} nm`} />
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
            Histograma (mock)
          </p>
          <div className="mt-3 flex h-36 items-end gap-0.5">
            {bars.map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t bg-gradient-to-t from-slate-300 to-emerald-500/80 opacity-95"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
          <p className="mt-2 font-mono text-[11px] text-slate-500">
            Exposición objetivo: {(wl / 42).toFixed(1)} ms (simulado)
          </p>
        </div>
      </div>
    </Card>
  );
}

function PanelCalWhite({ dash }) {
  const [phase, setPhase] = useState("idle");
  const [fil, setFil] = useState("720 nm");

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
      subtitle="Flujo de estados simulado: captura → procesamiento → subida."
    >
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[11px] text-slate-500">Filtro</span>
          <select
            value={fil}
            onChange={(e) => setFil(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900"
          >
            {WAVELENGTH_FILTERS.map((w) => (
              <option key={w.nm} value={w.label}>
                {w.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={run}
          disabled={phase !== "idle"}
          className="rounded-xl bg-gradient-to-r from-violet-600 to-emerald-600 px-5 py-2.5 font-semibold text-white shadow-lg disabled:opacity-40"
        >
          Capturar compensadores
        </button>
      </div>
      <div className="mt-4">
        <ScientificLiveView filterLabel={fil} />
      </div>
      <dl className="mt-4 grid gap-2 font-mono text-sm sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <dt className="text-[10px] uppercase text-slate-500">Captura</dt>
          <dd className="text-emerald-700">{phase === "capturing" ? "activa" : "idle"}</dd>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <dt className="text-[10px] uppercase text-slate-500">Procesamiento</dt>
          <dd className="text-amber-300">{phase === "processing" ? "en curso" : "—"}</dd>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <dt className="text-[10px] uppercase text-slate-500">Subida</dt>
          <dd className="text-violet-300">{phase === "uploading" ? "subiendo" : "—"}</dd>
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
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
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
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[11px] text-slate-500">Exposición (ms)</span>
              <input
                type="number"
                value={exp}
                onChange={(e) => setExp(e.target.value)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-sm"
              />
            </label>
          </div>
        </Card>
        <Card title="Metadatos de captura" subtitle="Panel derecho · configuración de sesión">
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[11px] text-slate-500">Nombre de cubo</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900"
            />
          </label>
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
          [{ t: label, msg: `Cubo #${next} adquirido (mock)` }, ...ev].slice(0, 12)
        );
        dash.appendLog(`[CAPTURE] Secuencia · cubo índice ${next}`);
        return next;
      });
    }, 4500);
    return () => window.clearInterval(id);
  }, [mission, dash]);

  return (
    <div className="space-y-4">
      <Card title="Captura continua" subtitle="Modo misión · temporizador y timeline simulados.">
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
            <p className="mt-1 font-mono text-xl text-slate-200">4.5 s (mock)</p>
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
      <Card title="Vista en vivo" subtitle="Preview técnico simulado + opción de stream real.">
        <ScientificLiveView filterLabel="550 nm" />
        <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50">
          <summary className="cursor-pointer px-4 py-3 font-mono text-sm text-slate-600 hover:text-slate-900">
            Stream JPEG por WebSocket (focus_live_server.py)
          </summary>
          <div className="border-t border-slate-200 p-4">
            <FocusLiveTest />
          </div>
        </details>
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
    case CAMERA_SECTION_IDS.STATUS:
      return <PanelStatus />;
    case CAMERA_SECTION_IDS.CONFIG:
      return <PanelConfig dash={dash} />;
    case CAMERA_SECTION_IDS.CAL_FILTERS:
      return <PanelCalFilters dash={dash} />;
    case CAMERA_SECTION_IDS.CAL_FOCUS:
      return <PanelCalFocus dash={dash} />;
    case CAMERA_SECTION_IDS.CAL_APERTURE:
      return <PanelCalAperture dash={dash} />;
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
