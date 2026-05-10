import { forwardRef } from "react";

function lineColor(line) {
  if (line.includes("[OK]") || line.includes("Online")) return "text-emerald-700";
  if (line.includes("[WARN]")) return "text-amber-700";
  if (line.includes("[ERR]") || line.includes("Error")) return "text-red-600";
  if (line.includes("[CAPTURE]")) return "text-teal-700";
  if (line.includes("[UPLOAD]")) return "text-violet-700";
  return "text-slate-700";
}

/**
 * Consola estilo terminal para logs mock (tema claro, coherente con el dashboard).
 */
const CameraLogConsole = forwardRef(function CameraLogConsole(
  { lines = [], title = "Consola del dispositivo", className = "" },
  ref
) {
  return (
    <div
      className={`flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-inner ${className}`}
    >
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-3 py-2">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-600">
          {title}
        </span>
        <span className="font-mono text-[10px] text-slate-400">mock · local</span>
      </div>
      <div
        ref={ref}
        className="max-h-[min(40vh,320px)] min-h-[140px] overflow-y-auto px-3 py-2 font-mono text-[11px] leading-relaxed sm:text-xs"
        role="log"
        aria-live="polite"
      >
        {lines.map((line, i) => (
          <p key={`${i}-${line.slice(0, 24)}`} className={`break-all ${lineColor(line)}`}>
            {line}
          </p>
        ))}
      </div>
    </div>
  );
});

export default CameraLogConsole;
