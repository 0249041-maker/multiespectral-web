import NeoPixelRing from "@/components/camera/NeoPixelRing.jsx";
import {
  GLOBAL_STATUS_KEYS,
  GLOBAL_STATUS_LABELS,
} from "@/lib/cameraDashboardConstants";

function StatusGlowBadge({ statusKey }) {
  const label = GLOBAL_STATUS_LABELS[statusKey] || statusKey;
  const danger = statusKey === "error";
  const warn =
    statusKey === "booting" ||
    statusKey === "wifi" ||
    statusKey === "server";
  const pulse =
    statusKey === "capturing" ||
    statusKey === "uploading" ||
    statusKey === "calibrating";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-wide sm:text-xs ${
        danger
          ? "border-red-200 bg-red-50 text-red-800 shadow-sm"
          : warn
            ? "border-amber-200 bg-amber-50 text-amber-900 shadow-sm"
            : pulse
              ? "border-emerald-300 bg-emerald-50 text-emerald-900 shadow-[0_0_12px_rgba(16,185,129,0.2)]"
              : "border-emerald-200 bg-emerald-50 text-emerald-900 shadow-sm"
      } ${pulse ? "animate-pulse" : ""}`}
    >
      {label}
    </span>
  );
}

/**
 * Cabecera principal del panel cámara: nombre, estado global, LED virtual, métricas mock.
 */
export default function CameraInstrumentHeader({ dash, shutdown }) {
  const {
    globalStatusKey,
    setGlobalStatusKey,
    online,
    setOnline,
    lastSeen,
    wifiSignal,
    serverOk,
    ledPattern,
    ledColor,
    appendLog,
  } = dash;

  const cameraStateLabel = shutdown?.cameraState
    ? shutdown.cameraState
    : null;

  return (
    <div className="border-b border-slate-200 bg-white px-4 py-4 shadow-sm md:px-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Dispositivo
              </p>
              <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900 md:text-2xl">
                Multiespectral π ·{" "}
                <span className="text-emerald-600">Lab Unit 01</span>
              </h1>
            </div>
            <StatusGlowBadge statusKey={globalStatusKey} />
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] ${
                shutdown?.shuttingDown
                  ? "border-amber-200 bg-amber-50 text-amber-900"
                  : online
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-slate-200 bg-slate-100 text-slate-500"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  shutdown?.shuttingDown
                    ? "animate-pulse bg-amber-500"
                    : online
                      ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]"
                      : "bg-slate-400"
                }`}
              />
              {shutdown?.shuttingDown
                ? "Apagando…"
                : online
                  ? "Online"
                  : "Offline"}
            </span>
            {cameraStateLabel ? (
              <span className="font-mono text-[11px] text-slate-500">
                state: <span className="text-slate-700">{cameraStateLabel}</span>
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 font-mono text-[11px] text-slate-600">
              Estado simulado
              <select
                value={globalStatusKey}
                onChange={(e) => {
                  setGlobalStatusKey(e.target.value);
                  appendLog(`[UI] Estado global mock → ${e.target.value}`);
                }}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                {GLOBAL_STATUS_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {GLOBAL_STATUS_LABELS[k] || k}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => setOnline((o) => !o)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-mono text-[11px] text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Toggle online (mock)
            </button>
          </div>

          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
              <dt className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Última conexión
              </dt>
              <dd className="mt-0.5 font-mono text-xs text-slate-800">{lastSeen}</dd>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
              <dt className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                WiFi
              </dt>
              <dd className="mt-0.5 flex items-center gap-2 font-mono text-xs text-slate-800">
                <span className="h-1.5 flex-1 max-w-[5rem] overflow-hidden rounded-full bg-slate-200">
                  <span
                    className="block h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all"
                    style={{ width: `${wifiSignal}%` }}
                  />
                </span>
                {wifiSignal}%
              </dd>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
              <dt className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Servidor
              </dt>
              <dd className="mt-0.5 font-mono text-xs text-slate-800">
                {serverOk ? (
                  <span className="text-emerald-700">OK · latencia ~42 ms (mock)</span>
                ) : (
                  <span className="text-red-600">Sin enlace</span>
                )}
              </dd>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
              <dt className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                LED hardware
              </dt>
              <dd className="mt-0.5 font-mono text-[11px] text-emerald-700">
                {ledPattern} · {ledColor}
              </dd>
            </div>
          </dl>
        </div>

        <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-4">
          <NeoPixelRing pattern={ledPattern} colorKey={ledColor} size={112} />
          <button
            type="button"
            disabled={!shutdown?.canShutdown}
            title={
              shutdown?.canShutdown
                ? "Enviar shutdown_camera por WebSocket"
                : "Apagado no disponible en el estado actual o sin conexión"
            }
            onClick={() => shutdown?.openModal?.()}
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 font-mono text-sm font-semibold text-red-800 shadow-sm transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Apagar cámara
          </button>
        </div>
      </div>
    </div>
  );
}
