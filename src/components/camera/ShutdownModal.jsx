/**
 * Modal de confirmación y seguimiento del apagado remoto (`shutdown_camera`).
 *
 * @param {{
 *   open: boolean,
 *   phase: "confirm" | "sending" | "ack_ok" | "progress" | "success" | "error",
 *   statusMessage?: string,
 *   errorDetail?: string,
 *   onCancel: () => void,
 *   onConfirm: () => void,
 *   confirmDisabled?: boolean,
 * }} props
 */
export default function ShutdownModal({
  open,
  phase,
  statusMessage = "",
  errorDetail = "",
  onCancel,
  onConfirm,
  confirmDisabled = false,
}) {
  if (!open) return null;

  const busy = phase === "sending" || phase === "ack_ok" || phase === "progress";
  const showConfirm = phase === "confirm";
  const showCloseOnly = phase === "success" || phase === "error";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shutdown-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        aria-label="Cerrar fondo"
        onClick={busy ? undefined : onCancel}
        disabled={busy}
      />
      <div className="relative z-[101] w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="border-b border-red-100 bg-red-50 px-5 py-4">
          <h2 id="shutdown-title" className="text-lg font-semibold text-red-900">
            Apagado remoto
          </h2>
          <p className="mt-1 text-sm text-red-800/90">
            {showConfirm
              ? "¿Está seguro que desea apagar la cámara?"
              : "Seguimiento del comando de apagado"}
          </p>
        </div>

        <div className="space-y-3 px-5 py-4">
          {showConfirm ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              <strong className="font-semibold">Advertencia:</strong> el dispositivo
              dejará de capturar y podría requerir encendido físico en campo.
            </div>
          ) : null}

          {!showConfirm && statusMessage ? (
            <div
              className={`rounded-lg border px-3 py-2 text-sm ${
                phase === "error"
                  ? "border-red-200 bg-red-50 text-red-900"
                  : phase === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                    : "border-slate-200 bg-slate-50 text-slate-800"
              }`}
            >
              {busy ? (
                <span className="mb-2 inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                </span>
              ) : null}{" "}
              {statusMessage}
            </div>
          ) : null}

          {phase === "error" && errorDetail ? (
            <p className="font-mono text-xs text-red-800">{errorDetail}</p>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2 pt-1">
            {showConfirm ? (
              <>
                <button
                  type="button"
                  onClick={onCancel}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={onConfirm}
                  disabled={confirmDisabled}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-50"
                >
                  Confirmar apagado
                </button>
              </>
            ) : null}

            {showCloseOnly ? (
              <button
                type="button"
                onClick={onCancel}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50"
              >
                Cerrar
              </button>
            ) : null}

            {busy ? (
              <button
                type="button"
                disabled
                className="rounded-lg border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-400"
              >
                Esperando respuesta…
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
