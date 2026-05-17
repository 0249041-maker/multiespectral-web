/**
 * Vista en vivo JPEG con overlay al pausar por cambio de filtro.
 * @param {{ frameUrl?: string, livePaused?: boolean, switchingFilter?: boolean, capturingCube?: boolean, waiting?: boolean, blanked?: boolean, placeholder?: string }} props
 */
export default function OpticalLiveView({
  frameUrl = "",
  livePaused = false,
  switchingFilter = false,
  capturingCube = false,
  waiting = false,
  blanked = false,
  placeholder = "Esperando vista en vivo…",
}) {
  const showSwitchOverlay = livePaused && switchingFilter;
  const showCaptureOverlay = livePaused && capturingCube;

  if (blanked) {
    return (
      <div
        className="h-[min(50vh,420px)] min-h-[240px] rounded-2xl border border-slate-200 bg-black"
        aria-label="Vista en vivo finalizada"
      />
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-black">
      {frameUrl ? (
        <img
          src={frameUrl}
          alt="Vista en vivo de calibración óptica"
          className={`max-h-[min(70vh,520px)] w-full object-contain transition-[filter] duration-300 ${
            showSwitchOverlay || showCaptureOverlay ? "blur-md brightness-90" : ""
          }`}
        />
      ) : (
        <div className="flex h-[min(50vh,420px)] min-h-[240px] items-center justify-center px-4 text-center text-sm text-slate-400">
          {waiting ? "Conectando y preparando calibración óptica…" : placeholder}
        </div>
      )}

      {showSwitchOverlay ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25">
          <p className="rounded-xl border border-white/20 bg-black/55 px-5 py-3 font-mono text-sm font-semibold tracking-wide text-white shadow-lg backdrop-blur-sm">
            Switching filter...
          </p>
        </div>
      ) : null}

      {showCaptureOverlay ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30">
          <p className="rounded-xl border border-white/20 bg-black/55 px-5 py-3 font-mono text-sm font-semibold tracking-wide text-white shadow-lg backdrop-blur-sm">
            Capturing cube...
          </p>
        </div>
      ) : null}
    </div>
  );
}
