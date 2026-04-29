import { useEffect, useState } from "react";

function parseHex(hex) {
  const h = hex.replace("#", "").trim();
  if (h.length !== 6) throw new Error("Color hex inválido");
  return {
    r: Number.parseInt(h.slice(0, 2), 16),
    g: Number.parseInt(h.slice(2, 4), 16),
    b: Number.parseInt(h.slice(4, 6), 16),
  };
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function luminanceFromRgba(r, g, b) {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!url.startsWith("blob:") && !url.startsWith("data:")) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo cargar la banda."));
    img.src = url;
  });
}

/**
 * Colorea una banda en escala de grises usando gradiente start->end.
 * El mapeo es lineal con estiramiento min-max por imagen.
 */
export default function SpectralBandColorized({
  src,
  startHex,
  endHex,
  alt,
  className,
}) {
  const [resolved, setResolved] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let blobUrl = null;
    setResolved("");
    setError(null);

    (async () => {
      try {
        const img = await loadImage(src);
        if (cancelled) return;

        const w = img.width;
        const h = img.height;
        const inCanvas = document.createElement("canvas");
        inCanvas.width = w;
        inCanvas.height = h;
        const inCtx = inCanvas.getContext("2d", { willReadFrequently: true });
        if (!inCtx) throw new Error("Canvas 2D no disponible.");
        inCtx.drawImage(img, 0, 0, w, h);
        const inData = inCtx.getImageData(0, 0, w, h);

        const n = w * h;
        const lum = new Float32Array(n);
        let minV = Infinity;
        let maxV = -Infinity;
        for (let i = 0; i < n; i++) {
          const o = i * 4;
          const v = luminanceFromRgba(
            inData.data[o],
            inData.data[o + 1],
            inData.data[o + 2]
          );
          lum[i] = v;
          if (v < minV) minV = v;
          if (v > maxV) maxV = v;
        }
        const range = Math.max(1e-9, maxV - minV);

        const c0 = parseHex(startHex);
        const c1 = parseHex(endHex);
        const out = inCtx.createImageData(w, h);

        for (let i = 0; i < n; i++) {
          const t = (lum[i] - minV) / range;
          const o = i * 4;
          out.data[o] = Math.round(lerp(c0.r, c1.r, t));
          out.data[o + 1] = Math.round(lerp(c0.g, c1.g, t));
          out.data[o + 2] = Math.round(lerp(c0.b, c1.b, t));
          out.data[o + 3] = 255;
        }

        const outCanvas = document.createElement("canvas");
        outCanvas.width = w;
        outCanvas.height = h;
        const outCtx = outCanvas.getContext("2d");
        if (!outCtx) throw new Error("Canvas 2D no disponible.");
        outCtx.putImageData(out, 0, 0);

        const blob = await new Promise((resolveBlob, rejectBlob) => {
          outCanvas.toBlob(
            (b) => {
              if (b) resolveBlob(b);
              else rejectBlob(new Error("No se pudo colorear la banda."));
            },
            "image/png",
            0.95
          );
        });

        if (cancelled) return;
        blobUrl = URL.createObjectURL(blob);
        setResolved(blobUrl);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Error al colorear banda.");
        }
      }
    })();

    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [src, startHex, endHex]);

  if (error) {
    return <p className="text-sm text-amber-200">{error}</p>;
  }
  if (!resolved) {
    return <p className="text-sm text-slate-300">Aplicando paleta…</p>;
  }
  return <img src={resolved} alt={alt} className={className} />;
}

