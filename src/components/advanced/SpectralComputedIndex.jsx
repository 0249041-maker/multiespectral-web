import { computeSpectralIndexPngFromBands } from "@/lib/spectralIndexPng";
import { useEffect, useState } from "react";

const FORMULAS = {
  GNDVI: "GNDVI = (NIR − G) / (NIR + G)",
  CI_re: "CIre = (NIR / RE) − 1",
  SIPI: "SIPI = (NIR − B) / (NIR − R)",
  VARI: "VARI = (G − R) / (G + R − B) — sin NIR",
};

/**
 * @param {{ visualization: "GNDVI" | "CI_re" | "SIPI" | "VARI"; bands: Record<string, string | undefined>; className?: string; onStats?: (s: { mean: number; min: number; max: number } | null) => void }}
 */
export default function SpectralComputedIndex({
  visualization,
  bands,
  className,
  onStats,
  compensators,
}) {
  const [src, setSrc] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState(null);
  const [rangeHint, setRangeHint] = useState("");

  const compKey = compensators
    ? `${compensators.r ?? ""}|${compensators.g ?? ""}|${compensators.b ?? ""}|${compensators.re ?? ""}|${compensators.nir ?? ""}`
    : "";

  useEffect(() => {
    let cancelled = false;
    let blobUrl = null;
    setBusy(true);
    setError(null);
    setSrc("");
    setRangeHint("");

    (async () => {
      try {
        const { blob, stats } = await computeSpectralIndexPngFromBands(
          bands,
          visualization,
          { compensators: compensators ?? null }
        );
        if (cancelled) return;
        blobUrl = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(blobUrl);
          return;
        }
        setSrc(blobUrl);
        onStats?.({
          mean: stats.mean,
          min: stats.min,
          max: stats.max,
        });
        if (visualization === "CI_re" || visualization === "SIPI") {
          setRangeHint(
            `Escala de color lineal en esta imagen: mín ${stats.min.toFixed(3)} (rojo) → máx ${stats.max.toFixed(3)} (verde).`
          );
        } else {
          setRangeHint(
            "Escala tipo NDVI: −1 (rojo) → +1 (verde) en cada píxel válido."
          );
        }
      } catch (e) {
        if (!cancelled) {
          onStats?.(null);
          setError(
            e instanceof Error ? e.message : "No se pudo calcular el índice."
          );
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();

    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    visualization,
    bands?.r,
    bands?.g,
    bands?.b,
    bands?.re,
    bands?.nir,
    onStats,
    compKey,
  ]);

  if (busy) {
    return (
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-sm text-slate-300">Calculando {visualization}…</p>
        <p className="max-w-md text-[11px] text-slate-400">{FORMULAS[visualization]}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex max-w-md flex-col items-center gap-2 text-center">
        <p className="text-sm text-amber-200">{error}</p>
        <p className="text-[11px] text-slate-400">{FORMULAS[visualization]}</p>
      </div>
    );
  }

  if (!src) return null;

  const fixedScale = visualization === "GNDVI" || visualization === "VARI";

  return (
    <div className="flex max-w-full flex-col items-center gap-3 sm:flex-row sm:items-stretch sm:justify-center sm:gap-4">
      <div className="flex min-w-0 flex-col items-center gap-2">
        <img
          src={src}
          alt={`Mapa ${visualization}`}
          className={className}
        />
        <p className="max-w-[min(100%,28rem)] text-center text-[11px] text-slate-400">
          {FORMULAS[visualization]}
        </p>
        {rangeHint ? (
          <p className="max-w-[min(100%,28rem)] text-center text-[10px] text-slate-500">
            {rangeHint}
          </p>
        ) : null}
      </div>
      <div
        className="flex h-[min(50vh,24rem)] min-h-[180px] flex-row items-stretch justify-center gap-2 sm:h-auto sm:min-h-[min(50vh,24rem)] sm:w-14 sm:flex-col sm:items-center sm:py-1"
        aria-hidden
      >
        <span className="self-center text-[10px] font-medium text-slate-300 sm:order-1">
          {fixedScale ? "1.0" : "alto"}
        </span>
        <div
          className="mx-auto w-full max-w-[12rem] flex-1 rounded border border-white/25 sm:order-2 sm:max-w-none sm:flex-1 sm:self-stretch"
          style={{
            background:
              "linear-gradient(to top, rgb(139,0,0) 0%, rgb(255,200,80) 50%, rgb(0,109,44) 100%)",
          }}
        />
        <span className="self-center text-[10px] font-medium text-slate-300 sm:order-3">
          {fixedScale ? "-1.0" : "bajo"}
        </span>
      </div>
    </div>
  );
}
