import { useStrawberryDetection } from "@/context/StrawberryDetectionContext";
import { useEffect, useState } from "react";
import { buildSpectralRgbCompositeBlob } from "@/lib/spectralRgbComposite";

/**
 * Una sola imagen RGB generada en cliente a partir de las URLs de banda.
 * Con 5 bandas: mezcla NIR+R+RE en el canal rojo del monitor; G y B en verde y azul.
 */
export default function SpectralRgbComposite({
  bands,
  className,
  caption,
  mode = "multispectral",
  publishForDetection = false,
}) {
  const {
    setSpectralRgbBitmap,
    setSpectralRgbBlob,
  } = useStrawberryDetection();
  const [resolved, setResolved] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let blobUrl = null;

    setBusy(true);
    setError(null);
    setResolved("");
    if (publishForDetection) {
      setSpectralRgbBlob(null);
      setSpectralRgbBitmap(null);
    }

    (async () => {
      try {
        const blob = await buildSpectralRgbCompositeBlob({
          r: bands.r,
          g: bands.g,
          b: bands.b,
          re: bands.re ?? null,
          nir: bands.nir ?? null,
        }, { mode });
        if (cancelled) return;
        if (publishForDetection) {
          setSpectralRgbBlob(blob);
        }
        let bmp = null;
        try {
          bmp = await createImageBitmap(blob);
        } catch {
          /* si falla, YOLO podrá usar archivo manual */
        }
        if (cancelled) {
          bmp?.close();
          return;
        }
        if (bmp && publishForDetection) {
          setSpectralRgbBitmap(bmp);
        }
        blobUrl = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(blobUrl);
          blobUrl = null;
          return;
        }
        setResolved(blobUrl);
      } catch (e) {
        if (!cancelled) {
          if (publishForDetection) {
            setSpectralRgbBlob(null);
            setSpectralRgbBitmap(null);
          }
          setError(e instanceof Error ? e.message : "Error al generar RGB.");
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();

    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [
    bands.r,
    bands.g,
    bands.b,
    bands.re,
    bands.nir,
    mode,
    publishForDetection,
    setSpectralRgbBitmap,
    setSpectralRgbBlob,
  ]);

  if (busy) {
    return (
      <div className="flex flex-col items-center gap-2 text-sm text-slate-400">
        <span className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-slate-500 border-t-emerald-400" />
        <span>Generando composición RGB…</span>
      </div>
    );
  }

  if (error) {
    return (
      <p className="max-w-md text-center text-sm text-amber-200">{error}</p>
    );
  }

  if (!resolved) return null;

  return (
    <div className="flex w-full max-w-3xl flex-col items-center gap-2">
      <img
        src={resolved}
        alt="RGB compuesto multiespectral"
        className={className}
      />
      {caption ? (
        <p className="max-w-xl text-center text-[11px] text-slate-400">
          {caption}
        </p>
      ) : null}
    </div>
  );
}
