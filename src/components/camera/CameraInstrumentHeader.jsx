import { useEffect, useRef, useState } from "react";
import { useCameraWs } from "@/context/CameraWebSocketContext";

function formatLastSeen(date) {
  if (!date) return "—";
  return date.toLocaleString("es", {
    dateStyle: "short",
    timeStyle: "medium",
  });
}

/**
 * Cabecera del panel cámara: nombre, estado online/offline derivado del
 * WebSocket real, última conexión (solo si offline) y botón de apagar.
 */
export default function CameraInstrumentHeader({ shutdown }) {
  const { connected } = useCameraWs();

  // Mantén la última vez que el WebSocket estuvo conectado. Mientras está
  // conectado se refresca cada segundo; al desconectarse, congela ese valor.
  const [lastSeenAt, setLastSeenAt] = useState(/** @type {Date | null} */ (null));
  const lastSeenAtRef = useRef(lastSeenAt);
  lastSeenAtRef.current = lastSeenAt;

  useEffect(() => {
    if (!connected) return undefined;
    setLastSeenAt(new Date());
    const id = window.setInterval(() => setLastSeenAt(new Date()), 1000);
    return () => window.clearInterval(id);
  }, [connected]);

  const shuttingDown = Boolean(shutdown?.shuttingDown);
  const online = connected;

  return (
    <div className="border-b border-slate-200 bg-white px-4 py-4 shadow-sm md:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900 md:text-2xl">
            Cámara multiespectral 1
          </h1>
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] font-semibold ${
                shuttingDown
                  ? "border-amber-200 bg-amber-50 text-amber-900"
                  : online
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  shuttingDown
                    ? "animate-pulse bg-amber-500"
                    : online
                      ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]"
                      : "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]"
                }`}
              />
              {shuttingDown ? "Apagando…" : online ? "Online" : "Offline"}
            </span>

            {!online ? (
              <span className="font-mono text-[11px] text-slate-500">
                Última conexión:{" "}
                <span className="text-slate-700">
                  {formatLastSeen(lastSeenAt)}
                </span>
              </span>
            ) : null}
          </div>
        </div>

        {online ? (
          <div className="flex flex-shrink-0">
            <button
              type="button"
              disabled={!shutdown?.canShutdown}
              title={
                shutdown?.canShutdown
                  ? "Enviar shutdown_camera por WebSocket"
                  : "Apagado no disponible en el estado actual"
              }
              onClick={() => shutdown?.openModal?.()}
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 font-mono text-sm font-semibold text-red-800 shadow-sm transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Apagar cámara
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
