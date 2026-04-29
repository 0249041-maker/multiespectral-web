import { computeNdviPngFromUrls } from "@/lib/ndvi";
import { useEffect, useState } from "react";

/**
 * NDVI recalculado al vuelo desde R y NIR (con alineación automática).
 * Esto evita depender de un NDVI histórico guardado con desalineación.
 */
export default function SpectralNdviComposite({ bands, className }) {
  const [resolved, setResolved] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let blobUrl = null;
    setBusy(true);
    setError(null);
    setResolved("");

    (async () => {
      try {
        const { blob } = await computeNdviPngFromUrls(bands.r, bands.nir);
        if (cancelled) return;
        blobUrl = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(blobUrl);
          blobUrl = null;
          return;
        }
        setResolved(blobUrl);
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error
              ? e.message
              : "No se pudo recomputar NDVI desde R y NIR."
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
  }, [bands.r, bands.nir]);

  if (busy) {
    return (
      <p className="text-sm text-slate-300">Recalculando NDVI alineado…</p>
    );
  }

  if (error) {
    return <p className="max-w-md text-center text-sm text-amber-200">{error}</p>;
  }

  if (!resolved) return null;

  return (
    <img
      src={resolved}
      alt="Mapa NDVI recalculado"
      className={className}
    />
  );
}

