import FocusLiveTest from "@/components/FocusLiveTest.jsx";
import {
  fetchCameraStatus,
  isValidWsUrl,
  upsertCameraTunnelUrl,
} from "@/lib/cameraStatus.js";
import { getSupabaseEnvDebug } from "@/lib/supabase";
import { useEffect, useState } from "react";

/**
 * Flujo: Conectar (tunnel_url en Supabase) → Vista JPEG por WebSocket.
 * No usa la webcam del PC: el vídeo viene del equipo + túnel Cloudflare (wss://).
 */
export default function CameraLiveFlow({ onBack }) {
  const [phase, setPhase] = useState("connect");
  const [resolvedUrl, setResolvedUrl] = useState("");
  const [pollErr, setPollErr] = useState("");
  const [publishDraft, setPublishDraft] = useState("");
  const [publishBusy, setPublishBusy] = useState(false);
  const [publishErr, setPublishErr] = useState("");
  const [cameraOnline, setCameraOnline] = useState(false);

  const { configured: supabaseOk } = getSupabaseEnvDebug();

  /**
   * Al entrar en Conectar: sin borradores ni URL en estado hasta que llegue de Supabase o publiques.
   */
  useEffect(() => {
    if (phase !== "connect") return;
    setResolvedUrl("");
    setPublishDraft("");
    setPublishErr("");
  }, [phase]);

  useEffect(() => {
    if (phase !== "connect" || !supabaseOk) return undefined;
    let cancelled = false;
    const run = async () => {
      try {
        const { tunnelUrl, online } = await fetchCameraStatus();
        if (cancelled) return;
        setCameraOnline(online);
        if (isValidWsUrl(tunnelUrl)) {
          setResolvedUrl(tunnelUrl);
          setPollErr("");
        } else {
          setResolvedUrl("");
        }
      } catch (e) {
        if (!cancelled) {
          setPollErr(e instanceof Error ? e.message : String(e));
        }
      }
    };
    run();
    const id = setInterval(run, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [phase, supabaseOk]);

  const handlePublish = async () => {
    setPublishErr("");
    if (!isValidWsUrl(publishDraft)) {
      setPublishErr("Introduce una URL que empiece por ws:// o wss://");
      return;
    }
    setPublishBusy(true);
    try {
      await upsertCameraTunnelUrl(publishDraft);
      const t = publishDraft.trim();
      setResolvedUrl(t);
    } catch (e) {
      setPublishErr(e instanceof Error ? e.message : String(e));
    } finally {
      setPublishBusy(false);
    }
  };

  const handleUseManualNoSupabase = () => {
    setPublishErr("");
    if (!isValidWsUrl(publishDraft)) {
      setPublishErr("Introduce el wss:// del túnel Cloudflare.");
      return;
    }
    const t = publishDraft.trim();
    setResolvedUrl(t);
  };

  const cameraReady = isValidWsUrl(resolvedUrl);

  if (phase === "live") {
    return (
      <div className="flex min-h-screen flex-col bg-slate-50">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
          <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-3 px-4 py-4 md:px-6">
            <button
              type="button"
              onClick={() => setPhase("connect")}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50"
            >
              <span aria-hidden className="text-lg leading-none">
                ←
              </span>
              Volver
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Vista en vivo
              </p>
              <h1 className="truncate text-lg font-semibold text-slate-900">
                Cámara multiespectral · JPEG (WebSocket)
              </h1>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:px-6">
          <FocusLiveTest
            key={resolvedUrl}
            seedWsUrl={resolvedUrl}
            autoStart
            compact
          />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-white">
      <div className="sr-only" aria-live="polite">
        {!cameraReady
          ? supabaseOk
            ? "Esperando tunnel_url de Cloudflare en camera_status (Supabase)."
            : "Indica el enlace del túnel o usa el guardado en este navegador."
          : "tunnel_url listo. Puedes abrir la vista en vivo."}
      </div>
      <header className="border-b border-white/10 px-4 py-3 md:px-6">
        <button
          type="button"
          onClick={onBack}
          className="text-sm font-medium text-slate-400 hover:text-white"
        >
          ← Volver
        </button>
      </header>

      <div className="flex flex-1 flex-col items-center px-4 pb-16 pt-8">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-400/90">
          Conectar cámara multiespectral
        </p>
        {supabaseOk ? (
          <p className="mt-1 text-center text-[11px] text-slate-500">
            Tabla <code className="text-slate-400">camera_status</code> ·{" "}
            <code className="text-slate-400">camera_001</code>
            {cameraOnline ? (
              <span className="text-emerald-500"> · online</span>
            ) : null}
          </p>
        ) : null}

        <div className="mt-auto flex flex-1 flex-col items-center justify-center">
          <button
            type="button"
            disabled={!cameraReady}
            onClick={() => setPhase("live")}
            className={`rounded-2xl px-14 py-5 text-lg font-semibold tracking-wide shadow-xl transition ${
              cameraReady
                ? "bg-emerald-500 text-white shadow-emerald-500/30 hover:bg-emerald-400"
                : "cursor-not-allowed bg-slate-800 text-slate-500"
            }`}
          >
            Cámara
          </button>

          <p
            className={`mt-6 max-w-xs text-center text-xs ${
              cameraReady ? "text-emerald-400/90" : "text-slate-500"
            }`}
          >
            {cameraReady
              ? supabaseOk
                ? "tunnel_url en Supabase listo (camera_001)."
                : "Enlace listo en este navegador."
              : supabaseOk
                ? "Esperando tunnel_url en Supabase (tabla camera_status)…"
                : "Pega el wss:// en Opciones y pulsa «Usar este enlace»."}
          </p>
          {cameraReady && supabaseOk ? (
            <p className="mt-3 max-w-xs text-center text-[11px] leading-snug text-slate-500">
              Esa URL está en la base de datos, no en el navegador. Para
              quitarla: en Supabase → Table Editor →{" "}
              <code className="text-slate-400">camera_status</code> → fila{" "}
              <code className="text-slate-400">camera_001</code> → borra{" "}
              <code className="text-slate-400">tunnel_url</code>.
            </p>
          ) : null}
        </div>

        {pollErr ? (
          <p className="mb-4 max-w-md text-center text-xs text-amber-400">
            {pollErr}
          </p>
        ) : null}

        <details className="mt-auto w-full max-w-md rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left">
          <summary className="cursor-pointer text-sm font-medium text-slate-400">
            Opciones · publicar tunnel_url (Cloudflare)
          </summary>
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            El equipo con la cámara multiespectral publica el{" "}
            <code className="text-slate-400">wss://…</code> aquí; se guarda en{" "}
            <code className="text-slate-400">camera_status.tunnel_url</code>{" "}
            para habilitar «Cámara». Sin Supabase, solo en este navegador.
          </p>
          <input
            type="text"
            value={publishDraft}
            onChange={(e) => setPublishDraft(e.target.value)}
            placeholder="wss://xxxx.trycloudflare.com"
            className="mt-2 w-full rounded-lg border border-white/15 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-600"
            autoComplete="off"
            spellCheck={false}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {supabaseOk ? (
              <button
                type="button"
                disabled={publishBusy}
                onClick={handlePublish}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {publishBusy ? "Publicando…" : "Publicar en Supabase"}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleUseManualNoSupabase}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
              >
                Usar este enlace
              </button>
            )}
          </div>
          {publishErr ? (
            <p className="mt-2 text-xs text-red-400">{publishErr}</p>
          ) : null}
        </details>
      </div>
    </div>
  );
}
