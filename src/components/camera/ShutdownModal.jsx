/**
 * Modal de confirmación de apagado remoto (solo UI).
 */
export default function ShutdownModal({ open, onCancel, onConfirm }) {
  if (!open) return null;

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
        onClick={onCancel}
      />
      <div className="relative z-[101] w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="border-b border-red-100 bg-red-50 px-5 py-4">
          <h2 id="shutdown-title" className="text-lg font-semibold text-red-900">
            Apagado remoto
          </h2>
          <p className="mt-1 text-sm text-red-800/90">
            ¿Seguro que deseas apagar la cámara?
          </p>
        </div>
        <div className="space-y-3 px-5 py-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            <strong className="font-semibold">Advertencia:</strong> el dispositivo dejará de
            capturar y podría requerir encendido físico en campo. Esta acción es simulada en la UI
            hasta conectar el backend.
          </div>
          <div className="flex flex-wrap justify-end gap-2 pt-1">
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
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700"
            >
              Confirmar apagado
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
