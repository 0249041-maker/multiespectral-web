import FocusLiveTest from "@/components/FocusLiveTest.jsx";

/**
 * Pantalla dedicada a control y estado de la cámara multiespectral (Raspberry Pi).
 */
export default function CameraControlPage({ onBack }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-3 px-4 py-4 md:px-6">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50"
          >
            <span aria-hidden className="text-lg leading-none">
              ←
            </span>
            Volver
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Dispositivo
            </p>
            <h1 className="truncate text-lg font-semibold text-slate-900">
              Cámara multiespectral
            </h1>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 md:px-6">
        <FocusLiveTest />

        <section
          aria-label="Estado de la cámara"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h2 className="text-base font-semibold text-slate-900">
            Conexión y estado
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Aquí se mostrará el estado de la Raspberry Pi, WiFi y enlace con el
            servidor (LED y modo en tiempo real cuando exista el canal con la
            cámara).
          </p>
          <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center text-sm text-slate-500">
            Sin cámara vinculada aún · conecta el servicio en la siguiente
            iteración
          </div>
        </section>

        <section
          aria-label="Acciones de calibración y captura"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h2 className="text-base font-semibold text-slate-900">
            Calibración y captura
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Desde esta pantalla podrás calibrar filtros, enfoque, diafragma,
            compensadores de blanco e iniciar capturas de cubos, según el flujo
            definido para el hardware.
          </p>
          <ul className="mt-4 list-inside list-disc space-y-1 text-sm text-slate-600">
            <li>Calibración de filtros y enfoque</li>
            <li>Diafragma y compensadores de blanco</li>
            <li>Captura individual y continua · apagado remoto</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
