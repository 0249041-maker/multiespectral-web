import { useEffect, useState } from "react";

/**
 * Vista en vivo: marco claro (dashboard) + área de preview oscura simulada (instrumento).
 */
export default function ScientificLiveView({
  filterLabel = "550 nm",
  connectionOk = true,
  showCrosshair = true,
  className = "",
  footerExtra = null,
}) {
  const [fps, setFps] = useState(14.2);
  const [exposureMs, setExposureMs] = useState(12.4);

  useEffect(() => {
    const id = window.setInterval(() => {
      setFps((v) => Math.min(30, Math.max(8, v + (Math.random() - 0.45) * 0.8)));
      setExposureMs((v) =>
        Math.min(48, Math.max(4, v + (Math.random() - 0.5) * 1.2))
      );
    }, 700);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white p-1 shadow-sm ${className}`}
    >
      <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-950 shadow-inner">
        <div className="camera-live-scanline relative aspect-video w-full min-h-[200px]">
          <div
            className="camera-live-signal absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950"
            aria-hidden
          />
          <div
            className="absolute inset-0 opacity-[0.15]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E")`,
              backgroundSize: "180px 180px",
            }}
            aria-hidden
          />
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(52,211,153,0.22) 1px, transparent 1px), linear-gradient(90deg, rgba(52,211,153,0.12) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
            aria-hidden
          />

          {showCrosshair ? (
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full text-emerald-400/30"
              aria-hidden
            >
              <line x1="50%" y1="0" x2="50%" y2="100%" stroke="currentColor" strokeWidth="1" />
              <line x1="0" y1="50%" x2="100%" y2="50%" stroke="currentColor" strokeWidth="1" />
              <circle
                cx="50%"
                cy="50%"
                r="18%"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                strokeDasharray="4 6"
              />
            </svg>
          ) : null}

          <div className="absolute left-2 top-2 flex flex-wrap gap-2 font-mono text-[10px] text-emerald-100/95 sm:text-xs">
            <span className="rounded border border-emerald-500/35 bg-black/45 px-2 py-0.5 backdrop-blur-sm">
              FILTRO {filterLabel}
            </span>
            <span className="rounded border border-emerald-500/30 bg-black/40 px-2 py-0.5 text-emerald-200/95 backdrop-blur-sm">
              EXP {exposureMs.toFixed(1)} ms
            </span>
            <span className="rounded border border-slate-500 bg-black/40 px-2 py-0.5 text-slate-200 backdrop-blur-sm">
              FPS {fps.toFixed(1)} <span className="text-slate-500">sim</span>
            </span>
          </div>

          <div className="absolute right-2 top-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] backdrop-blur-sm sm:text-[11px] ${
                connectionOk
                  ? "border-emerald-400/50 bg-emerald-950/75 text-emerald-200 shadow-[0_0_10px_rgba(52,211,153,0.25)]"
                  : "border-red-500/50 bg-red-950/70 text-red-200"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  connectionOk ? "animate-pulse bg-emerald-400" : "bg-red-500"
                }`}
              />
              {connectionOk ? "STREAM OK" : "SIN SEÑAL"}
            </span>
          </div>

          <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between gap-2">
            <div className="font-mono text-[9px] uppercase tracking-widest text-slate-500 sm:text-[10px]">
              MVSDK · MOCK PREVIEW
            </div>
            {footerExtra}
          </div>
        </div>
      </div>
    </div>
  );
}
