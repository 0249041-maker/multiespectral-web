import OpticalLiveView from "@/components/camera/OpticalLiveView.jsx";
import SupabaseImage from "@/components/advanced/SupabaseImage.jsx";
import { useWhiteCalibration } from "@/hooks/useWhiteCalibration";
import {
  CALIBRATION_LED,
  CAMERA_LIVE_WS_URL,
  WHITE_CALIBRATION_BANDS_NM,
  WHITE_COMPENSATORS_BUCKET,
  WAVELENGTH_FILTERS,
} from "@/lib/cameraDashboardConstants";
import { getSupabaseEnvDebug } from "@/lib/supabase";
import { computeCompensatorsFromSession } from "@/lib/whiteCompensatorCompute";
import { listWhiteCompensatorSessions } from "@/lib/whiteCompensatorsStorage";
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

function CompensatorTable({ compensators }) {
  if (!compensators) return null;
  return (
    <dl className="mt-3 grid grid-cols-2 gap-2 font-mono text-xs sm:grid-cols-5">
      {WHITE_CALIBRATION_BANDS_NM.map((nm) => (
        <div
          key={nm}
          className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-center"
        >
          <dt className="text-[10px] text-slate-500">{nm} nm</dt>
          <dd className="text-base font-semibold text-emerald-700">
            {compensators[String(nm)] ?? "—"}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function PanelCalWhiteNew({ dash }) {
  const white = useWhiteCalibration({
    wsUrl: CAMERA_LIVE_WS_URL,
    appendLog: dash.appendLog,
    opticalExposureMs: dash.opticalExposureMs,
    onSessionStart: () =>
      dash.startCalibrationLed(CALIBRATION_LED.WHITE.pattern, CALIBRATION_LED.WHITE.color),
    onWhiteReferenceReady: (ref) => {
      dash.setActiveWhiteReference({
        cube_id: ref.cube_id,
        storage_path: ref.storage_path,
        exposure_ms: ref.exposure_ms ?? dash.opticalExposureMs ?? undefined,
        bucket: ref.bucket,
        compensators: ref.compensators,
      });
      dash.finishCalibrationLed(CALIBRATION_LED.WHITE_DONE.pattern, CALIBRATION_LED.WHITE_DONE.color);
      dash.appendLog(
        `[OK] Compensadores calculados · ${ref.cube_id} · bandas ${Object.keys(ref.compensators).join(", ")}`
      );
    },
  });

  return (
    <div className="space-y-4">
      {dash.opticalExposureMs == null ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Completa primero la <strong>calibración óptica</strong> (enfoque/diafragma) para fijar la
          exposición del cubo blanco.
        </p>
      ) : (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-600">
          Exposición óptica: <span className="text-emerald-700">{dash.opticalExposureMs} ms</span>{" "}
          (la cámara usará esta exposición al capturar blancos).
        </p>
      )}

      <p className="font-mono text-xs text-slate-500">
        WebSocket:{" "}
        <code className="rounded bg-slate-100 px-1">{white.wsUrl}</code>
        <span className={white.connected ? " ml-2 text-emerald-600" : " ml-2 text-amber-600"}>
          {white.connected ? "conectado" : "desconectado"}
        </span>
      </p>

      {white.connectionError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {white.connectionError}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        {!white.sessionActive ? (
          <button
            type="button"
            disabled={white.controlsDisabled || !white.hasOpticalExposure}
            onClick={white.startWhiteCalibration}
            className="rounded-xl bg-emerald-600 px-5 py-2.5 font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
          >
            Iniciar calibración
          </button>
        ) : null}
        <button
          type="button"
          disabled={
            !white.sessionActive || white.controlsDisabled || white.processing
          }
          onClick={white.captureWhiteReference}
          className="rounded-xl bg-gradient-to-r from-violet-600 to-emerald-600 px-5 py-2.5 font-semibold text-white shadow-lg disabled:opacity-40"
        >
          {white.processing ? "Procesando BMP…" : "Capturar blancos"}
        </button>
      </div>

      {white.showLiveView ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase text-slate-500">Preview filtro</span>
            {WAVELENGTH_FILTERS.map((w) => (
              <button
                key={w.id}
                type="button"
                disabled={white.controlsDisabled}
                onClick={() => white.moveFilter(w.id)}
                className={`rounded-full border px-2.5 py-1 font-mono text-[11px] ${
                  white.selectedFilterId === w.id
                    ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                    : "border-slate-300 text-slate-600"
                }`}
              >
                {w.nm}
              </button>
            ))}
          </div>
          <OpticalLiveView
            frameUrl={white.frameUrl}
            livePaused={white.livePaused}
            switchingFilter={white.switchingFilter}
            waiting={!white.frameUrl}
            placeholder="Acomoda la cartulina blanca…"
          />
        </>
      ) : white.liveViewEnded || white.liveViewBlanked ? (
        <OpticalLiveView blanked />
      ) : (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          Inicia la calibración para ver la cámara en vivo y colocar la cartulina blanca.
        </p>
      )}

      {white.statusText ? (
        <p className="text-sm font-medium text-slate-700">{white.statusText}</p>
      ) : null}

      {dash.activeWhiteReference ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4">
          <p className="text-sm font-semibold text-emerald-900">Referencia blanca activa</p>
          <p className="mt-1 font-mono text-xs text-emerald-800">
            {dash.activeWhiteReference.cube_id}
          </p>
          <CompensatorTable compensators={dash.activeWhiteReference.compensators} />
        </div>
      ) : null}
    </div>
  );
}

function PanelCalWhitePast({ dash }) {
  const supabaseDebug = getSupabaseEnvDebug();
  const appendLogRef = useRef(dash.appendLog);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [sessions, setSessions] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const loadedRef = useRef(false);

  appendLogRef.current = dash.appendLog;

  const load = useCallback(async () => {
    if (!supabaseDebug.configured) {
      setError("Supabase no está configurado.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const list = await listWhiteCompensatorSessions();
      setSessions(list);
      appendLogRef.current?.(
        `[CAL] ${list.length} cubo(s) blanco en ${WHITE_COMPENSATORS_BUCKET}`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al listar");
    } finally {
      setLoading(false);
    }
  }, [supabaseDebug.configured]);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    load();
  }, [load]);

  const selected = sessions.find((s) => s.id === selectedId) ?? null;

  const applySession = async (session) => {
    setProcessing(true);
    setError("");
    try {
      const ref = await computeCompensatorsFromSession(session);
      dash.setActiveWhiteReference({
        cube_id: ref.cube_id,
        storage_path: ref.storage_path,
        exposure_ms: dash.opticalExposureMs ?? undefined,
        compensators: ref.compensators,
      });
      dash.finishCalibrationLed(CALIBRATION_LED.WHITE_DONE.pattern, CALIBRATION_LED.WHITE_DONE.color);
      dash.appendLog(`[OK] Compensador histórico · ${session.id}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al procesar";
      setError(msg);
      dash.appendLog(`[ERR] ${msg}`);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      {!supabaseDebug.configured ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Configura Supabase para listar cubos en{" "}
          <code className="rounded bg-amber-100 px-1">{WHITE_COMPENSATORS_BUCKET}</code>.
        </p>
      ) : null}

      {loading ? (
        <p className="py-6 text-center text-sm text-slate-500">Cargando calibraciones…</p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
          <button type="button" onClick={load} className="ml-2 underline">
            Reintentar
          </button>
        </p>
      ) : null}

      {!loading && !error && sessions.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          No hay cubos en{" "}
          <span className="font-mono">camera_xxx/white_YYYYMMDD_HHMMSS/</span>
        </p>
      ) : null}

      {sessions.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sessions.map((session) => {
            const preview = session.bandFiles.find((b) => b.nm === 550) ?? session.bandFiles[0];
            return (
              <button
                key={session.id}
                type="button"
                onClick={() => setSelectedId(session.id)}
                className={`overflow-hidden rounded-xl border text-left ${
                  selectedId === session.id
                    ? "border-emerald-500 ring-2 ring-emerald-200"
                    : "border-slate-200"
                }`}
              >
                <div className="aspect-video bg-black">
                  {preview?.url ? (
                    <SupabaseImage
                      src={preview.url}
                      alt={session.cubeId}
                      className="h-full w-full object-contain"
                    />
                  ) : null}
                </div>
                <div className="p-2">
                  <p className="truncate font-mono text-xs font-semibold">{session.cubeId}</p>
                  <p className="text-[10px] text-slate-500">{session.cameraId}</p>
                </div>
              </button>
            );
          })}
        </div>
      ) : null}

      {selected ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="font-mono text-sm font-semibold">{selected.id}</p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {selected.bandFiles.map((b) => (
              <div key={b.path} className="rounded border border-slate-200 bg-black">
                <SupabaseImage src={b.url} alt={b.name} className="aspect-square w-full object-contain" />
                <p className="bg-white px-1 py-0.5 text-center font-mono text-[10px]">{b.nm}</p>
              </div>
            ))}
          </div>
          <button
            type="button"
            disabled={processing}
            onClick={() => applySession(selected)}
            className="mt-4 rounded-xl bg-emerald-600 px-5 py-2.5 font-semibold text-white disabled:opacity-50"
          >
            {processing ? "Calculando compensadores…" : "Usar esta calibración"}
          </button>
        </div>
      ) : null}

      {dash.activeWhiteReference ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-900">Activa en el instrumento</p>
          <CompensatorTable compensators={dash.activeWhiteReference.compensators} />
        </div>
      ) : null}
    </div>
  );
}

export default function PanelCalWhite({ dash }) {
  const [tab, setTab] = useState("new");

  return (
    <Card
      title="Calibración de compensadores blancos"
      subtitle="Captura nueva referencia por WebSocket o reutiliza un cubo en Supabase Storage."
    >
      <div className="mb-6 flex gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setTab("new")}
          className={`border-b-2 px-4 py-2 text-sm font-semibold transition ${
            tab === "new"
              ? "border-emerald-600 text-emerald-800"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Nueva calibración
        </button>
        <button
          type="button"
          onClick={() => setTab("past")}
          className={`border-b-2 px-4 py-2 text-sm font-semibold transition ${
            tab === "past"
              ? "border-violet-600 text-violet-800"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Usar calibración pasada
        </button>
      </div>

      {tab === "new" ? <PanelCalWhiteNew key="white-new" dash={dash} /> : null}
      {tab === "past" ? <PanelCalWhitePast key="white-past" dash={dash} /> : null}
    </Card>
  );
}
