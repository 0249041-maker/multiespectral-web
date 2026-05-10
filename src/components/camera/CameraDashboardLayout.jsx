import CameraInstrumentHeader from "@/components/camera/CameraInstrumentHeader.jsx";
import CameraSectionPanels from "@/components/camera/CameraSectionPanels.jsx";
import CameraSidebar from "@/components/camera/CameraSidebar.jsx";
import ShutdownModal from "@/components/camera/ShutdownModal.jsx";
import { useCameraDashboardMocks } from "@/state/useCameraDashboardMocks";

/**
 * Layout principal del panel de cámara (solo UI / mocks).
 * Paleta alineada con el dashboard principal: slate-50, blanco, acento esmeralda.
 */
export default function CameraDashboardLayout({ embedded = false, onBack }) {
  const dash = useCameraDashboardMocks();

  const shellClass = embedded
    ? "flex min-h-0 flex-1 flex-col bg-slate-50 text-slate-900"
    : "flex min-h-screen flex-col bg-slate-50 text-slate-900";

  const inner = (
    <>
      {!embedded && (
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-4 md:px-6">
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
      )}

      {embedded ? (
        <div className="border-b border-slate-200 bg-white px-4 py-3 md:px-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Dispositivo
          </p>
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">
            Cámara multiespectral
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Raspberry Pi 5 · panel de instrumentación (interfaz simulada)
          </p>
        </div>
      ) : null}

      <CameraInstrumentHeader dash={dash} />

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <CameraSidebar activeId={dash.section} onSelect={dash.setSection} />
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-slate-50">
          <div className="mx-auto max-w-7xl px-4 py-5 md:px-6 lg:py-6">
            <CameraSectionPanels section={dash.section} dash={dash} />
          </div>
        </div>
      </div>

      <ShutdownModal
        open={dash.shutdownOpen}
        onCancel={() => dash.setShutdownOpen(false)}
        onConfirm={() => {
          dash.appendLog("[WARN] Apagado confirmado (mock · sin comando SSH/WebSocket).");
          dash.setShutdownOpen(false);
          dash.setOnline(false);
          dash.setGlobalStatusKey("error");
        }}
      />
    </>
  );

  if (embedded) {
    return (
      <main
        id="panel-camera"
        role="tabpanel"
        aria-labelledby="tab-camera"
        className={shellClass}
      >
        {inner}
      </main>
    );
  }

  return <div className={shellClass}>{inner}</div>;
}
