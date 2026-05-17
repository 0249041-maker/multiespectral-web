import FocusLiveTest from "@/components/FocusLiveTest.jsx";
import SupabaseImage from "@/components/advanced/SupabaseImage.jsx";
import {
  CALIBRATION_LED,
  CAMERA_LIVE_WS_URL,
  WHITE_COMPENSATORS_BUCKET,
} from "@/lib/cameraDashboardConstants";
import { getSupabaseEnvDebug } from "@/lib/supabase";
import { listWhiteCompensatorSessions } from "@/lib/whiteCompensatorsStorage";
import { useCallback, useEffect, useState } from "react";

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

function BackButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-4 text-sm font-medium text-slate-600 hover:text-emerald-700"
    >
      ← Volver
    </button>
  );
}

function PanelCalWhiteCreate({ dash, onBack }) {
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
      title="Crear compensador"
      subtitle="Inicia la calibración para ver la cámara en vivo, luego captura los compensadores."
    >
      <BackButton onClick={onBack} />
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

function PanelCalWhiteReuse({ dash, onBack }) {
  const supabaseDebug = getSupabaseEnvDebug();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sessions, setSessions] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const load = useCallback(async () => {
    if (!supabaseDebug.configured) {
      setError("Supabase no está configurado en este entorno.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const list = await listWhiteCompensatorSessions();
      setSessions(list);
      dash.appendLog(`[CAL] ${list.length} compensador(es) en Storage · ${WHITE_COMPENSATORS_BUCKET}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al listar compensadores";
      setError(msg);
      dash.appendLog(`[ERR] Blancos Storage · ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [dash, supabaseDebug.configured]);

  useEffect(() => {
    load();
  }, [load]);

  const selected = sessions.find((s) => s.id === selectedId) ?? null;
  const activeId = dash.activeWhiteCompensator?.id;

  const applySession = (session) => {
    dash.setActiveWhiteCompensator({
      id: session.id,
      folder: session.folder,
      files: session.files,
    });
    dash.appendLog(`[CAL] Compensador activo · ${session.folder} (${session.files.length} archivos)`);
  };

  return (
    <Card
      title="Utilizar compensadores antiguos"
      subtitle={`Carpetas en Storage · bucket ${WHITE_COMPENSATORS_BUCKET}`}
    >
      <BackButton onClick={onBack} />

      {dash.activeWhiteCompensator ? (
        <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Compensador en uso:{" "}
          <span className="font-mono font-semibold">{dash.activeWhiteCompensator.folder}</span>
          <button
            type="button"
            onClick={() => {
              dash.setActiveWhiteCompensator(null);
              dash.appendLog("[CAL] Compensador activo desactivado.");
            }}
            className="ml-2 text-xs underline hover:no-underline"
          >
            Quitar
          </button>
        </p>
      ) : null}

      {!supabaseDebug.configured ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Configura <code className="rounded bg-amber-100 px-1">VITE_SUPABASE_URL</code> y{" "}
          <code className="rounded bg-amber-100 px-1">VITE_SUPABASE_ANON_KEY</code> para listar
          compensadores.
        </p>
      ) : null}

      {loading ? (
        <p className="py-8 text-center text-sm text-slate-500">Cargando compensadores…</p>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
          <button
            type="button"
            onClick={load}
            className="ml-2 underline hover:no-underline"
          >
            Reintentar
          </button>
        </div>
      ) : null}

      {!loading && !error && sessions.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          No hay carpetas de compensadores en{" "}
          <code className="font-mono text-xs">{WHITE_COMPENSATORS_BUCKET}</code>. La Raspberry puede
          subir cada sesión como una carpeta con imágenes por banda.
        </p>
      ) : null}

      {!loading && sessions.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sessions.map((session) => {
            const preview = session.files[0];
            const isSelected = selectedId === session.id;
            const isActive = activeId === session.id;
            return (
              <button
                key={session.id}
                type="button"
                onClick={() => setSelectedId(session.id)}
                className={`overflow-hidden rounded-xl border text-left transition ${
                  isSelected
                    ? "border-emerald-500 ring-2 ring-emerald-200"
                    : "border-slate-200 hover:border-emerald-300"
                } ${isActive ? "bg-emerald-50/50" : "bg-white"}`}
              >
                <div className="aspect-video bg-slate-900">
                  {preview?.publicUrl ? (
                    <SupabaseImage
                      src={preview.publicUrl}
                      alt={`Vista previa ${session.folder}`}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-slate-500">
                      Sin vista previa
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="truncate font-mono text-sm font-semibold text-slate-900">
                    {session.folder}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {session.files.length} archivo(s)
                    {isActive ? " · en uso" : ""}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      ) : null}

      {selected ? (
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="font-mono text-sm font-semibold text-slate-900">{selected.folder}</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {selected.files.map((f) => (
              <div key={f.path} className="overflow-hidden rounded-lg border border-slate-200 bg-black">
                <SupabaseImage
                  src={f.publicUrl}
                  alt={f.name}
                  className="aspect-square w-full object-contain"
                />
                <p className="truncate bg-white px-2 py-1 font-mono text-[10px] text-slate-600">
                  {f.name}
                </p>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => applySession(selected)}
            className="mt-4 rounded-xl bg-emerald-600 px-5 py-2.5 font-semibold text-white shadow-sm hover:bg-emerald-700"
          >
            Usar este compensador
          </button>
        </div>
      ) : null}
    </Card>
  );
}

/** @param {{ dash: import("@/state/useCameraDashboardMocks").ReturnType }} props */
export default function PanelCalWhite({ dash }) {
  const [mode, setMode] = useState(null);

  if (mode === "create") {
    return <PanelCalWhiteCreate dash={dash} onBack={() => setMode(null)} />;
  }

  if (mode === "reuse") {
    return <PanelCalWhiteReuse dash={dash} onBack={() => setMode(null)} />;
  }

  return (
    <Card
      title="Calibración de compensadores blancos"
      subtitle="Elige si vas a capturar un compensador nuevo o reutilizar uno guardado en la nube."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setMode("create")}
          className="flex flex-col items-start gap-2 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-6 text-left shadow-sm transition hover:border-emerald-400 hover:shadow-md"
        >
          <span className="text-lg font-semibold text-emerald-900">Crear compensador</span>
          <span className="text-sm text-slate-600">
            Vista en vivo, captura de placas blancas y subida de un compensador nuevo.
          </span>
        </button>
        <button
          type="button"
          onClick={() => setMode("reuse")}
          className="flex flex-col items-start gap-2 rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-6 text-left shadow-sm transition hover:border-violet-400 hover:shadow-md"
        >
          <span className="text-lg font-semibold text-violet-900">
            Utilizar compensadores antiguos
          </span>
          <span className="text-sm text-slate-600">
            Selecciona una carpeta desde Supabase Storage (
            <code className="text-xs">{WHITE_COMPENSATORS_BUCKET}</code>).
          </span>
        </button>
      </div>
    </Card>
  );
}
