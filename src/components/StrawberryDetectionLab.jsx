import { useStrawberryDetection } from "@/context/StrawberryDetectionContext";
import {
  getDefaultModelUrl,
  getOrCreateSession,
  letterboxToTensor,
  mapBoxToOriginal,
  runStrawberryInference,
} from "@/lib/yoloStrawberry";
import { analyzeStrawberryMaturityInBoxes } from "@/lib/strawberryMaturity";
import { loadImageCrossOrigin } from "@/lib/spectralRgbComposite";
import { useCallback, useEffect, useRef, useState } from "react";

function iou(a, b) {
  const x1 = Math.max(a.x1, b.x1);
  const y1 = Math.max(a.y1, b.y1);
  const x2 = Math.min(a.x2, b.x2);
  const y2 = Math.min(a.y2, b.y2);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const areaA = Math.max(0, a.x2 - a.x1) * Math.max(0, a.y2 - a.y1);
  const areaB = Math.max(0, b.x2 - b.x1) * Math.max(0, b.y2 - b.y1);
  return inter / (areaA + areaB - inter + 1e-9);
}

function nmsMerge(boxes, iouThreshold = 0.55) {
  const sorted = [...boxes].sort((a, b) => b.score - a.score);
  const keep = [];
  while (sorted.length) {
    const best = sorted.shift();
    keep.push(best);
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (iou(best, sorted[i]) >= iouThreshold) sorted.splice(i, 1);
    }
  }
  return keep;
}

function boxCenter(box) {
  return {
    cx: (box.x1 + box.x2) * 0.5,
    cy: (box.y1 + box.y2) * 0.5,
  };
}

function boxDiag(box) {
  return Math.hypot(Math.max(1, box.x2 - box.x1), Math.max(1, box.y2 - box.y1));
}

function computeBoxVisualStats(imageData, width, height, box) {
  const x1 = Math.max(0, Math.floor(box.x1));
  const y1 = Math.max(0, Math.floor(box.y1));
  const x2 = Math.min(width, Math.ceil(box.x2));
  const y2 = Math.min(height, Math.ceil(box.y2));
  if (x2 <= x1 || y2 <= y1) {
    return { meanLuma: 0, stdLuma: 0, meanSat: 0 };
  }

  const d = imageData.data;
  let sumL = 0;
  let sumL2 = 0;
  let sumS = 0;
  let n = 0;
  for (let y = y1; y < y2; y++) {
    const row = y * width;
    for (let x = x1; x < x2; x++) {
      const o = (row + x) * 4;
      const r = d[o] / 255;
      const g = d[o + 1] / 255;
      const b = d[o + 2] / 255;
      const l = 0.299 * r + 0.587 * g + 0.114 * b;
      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const sat = maxC <= 1e-6 ? 0 : (maxC - minC) / maxC;
      sumL += l;
      sumL2 += l * l;
      sumS += sat;
      n++;
    }
  }
  if (!n) return { meanLuma: 0, stdLuma: 0, meanSat: 0 };
  const meanLuma = sumL / n;
  const varL = Math.max(0, sumL2 / n - meanLuma * meanLuma);
  return {
    meanLuma,
    stdLuma: Math.sqrt(varL),
    meanSat: sumS / n,
  };
}

function suppressLikelyShadowDetections(boxes, bmp) {
  if (!boxes.length) return boxes;
  const c = document.createElement("canvas");
  c.width = bmp.width;
  c.height = bmp.height;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return boxes;
  ctx.drawImage(bmp, 0, 0);
  const imageData = ctx.getImageData(0, 0, bmp.width, bmp.height);

  const sorted = [...boxes].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const dropped = new Set();
  for (let i = 0; i < sorted.length; i++) {
    if (dropped.has(i)) continue;
    const bi = sorted[i];
    const si = computeBoxVisualStats(imageData, bmp.width, bmp.height, bi);
    const scoreI = bi.score ?? 0;
    const centerI = boxCenter(bi);
    const diagI = boxDiag(bi);
    const likelyShadow = si.meanLuma < 0.25 && si.stdLuma < 0.11 && si.meanSat < 0.24;
    if (!likelyShadow || scoreI > 0.30) continue;
    for (let j = 0; j < i; j++) {
      if (dropped.has(j)) continue;
      const bj = sorted[j];
      const scoreJ = bj.score ?? 0;
      if (scoreJ < scoreI + 0.08) continue;
      const overlap = iou(bi, bj);
      const centerJ = boxCenter(bj);
      const centerDist = Math.hypot(centerI.cx - centerJ.cx, centerI.cy - centerJ.cy);
      const closeToStronger = centerDist <= Math.max(diagI, boxDiag(bj)) * 0.85;
      if (overlap >= 0.12 || closeToStronger) {
        dropped.add(i);
        break;
      }
    }
  }
  return sorted.filter((_, idx) => !dropped.has(idx));
}

function enforceDisjointDetections(boxes) {
  if (!boxes.length) return boxes;
  const sorted = [...boxes].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const keep = [];
  for (const candidate of sorted) {
    let sharesPixels = false;
    for (const accepted of keep) {
      const x1 = Math.max(candidate.x1, accepted.x1);
      const y1 = Math.max(candidate.y1, accepted.y1);
      const x2 = Math.min(candidate.x2, accepted.x2);
      const y2 = Math.min(candidate.y2, accepted.y2);
      const interW = Math.max(0, x2 - x1);
      const interH = Math.max(0, y2 - y1);
      if (interW > 0 && interH > 0) {
        sharesPixels = true;
        break;
      }
    }
    if (!sharesPixels) keep.push(candidate);
  }
  return keep;
}

async function upscaleBitmap(imageBitmap, factor = 2) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(imageBitmap.width * factor));
  c.height = Math.max(1, Math.round(imageBitmap.height * factor));
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D no disponible");
  ctx.drawImage(imageBitmap, 0, 0, c.width, c.height);
  return createImageBitmap(c);
}

function makeTiles(width, height) {
  const tileW = Math.max(256, Math.round(width * 0.6));
  const tileH = Math.max(256, Math.round(height * 0.6));
  const xs = Array.from(
    new Set([
      0,
      Math.max(0, Math.round((width - tileW) / 2)),
      Math.max(0, width - tileW),
    ])
  );
  const ys = Array.from(
    new Set([
      0,
      Math.max(0, Math.round((height - tileH) / 2)),
      Math.max(0, height - tileH),
    ])
  );
  const tiles = [];
  for (const x of xs) {
    for (const y of ys) {
      tiles.push({ x, y, w: Math.min(tileW, width - x), h: Math.min(tileH, height - y) });
    }
  }
  return tiles;
}

function scaleBoxes(boxes, scaleX, scaleY) {
  if (scaleX === 1 && scaleY === 1) return boxes;
  return boxes.map((b) => ({
    ...b,
    x1: b.x1 * scaleX,
    x2: b.x2 * scaleX,
    y1: b.y1 * scaleY,
    y2: b.y2 * scaleY,
  }));
}

async function runInferenceOnCrop(session, sourceBmp, crop, confThreshold, iouThreshold) {
  const c = document.createElement("canvas");
  c.width = crop.w;
  c.height = crop.h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D no disponible");
  ctx.drawImage(
    sourceBmp,
    crop.x,
    crop.y,
    crop.w,
    crop.h,
    0,
    0,
    crop.w,
    crop.h
  );
  const cropBmp = await createImageBitmap(c);
  try {
    const { tensorData, meta } = letterboxToTensor(cropBmp);
    const boxes = await runStrawberryInference(session, tensorData, {
      confThreshold,
      iouThreshold,
    });
    return boxes.map((b) => {
      const m = mapBoxToOriginal(b, meta);
      return {
        ...m,
        x1: m.x1 + crop.x,
        x2: m.x2 + crop.x,
        y1: m.y1 + crop.y,
        y2: m.y2 + crop.y,
      };
    });
  } finally {
    cropBmp.close?.();
  }
}

export default function StrawberryDetectionLab({ children } = {}) {
  const {
    setDetectionResult,
    spectralRgbBitmap,
    spectralRgbBlob,
    spectralCubeBands,
    spectralCubeSelection,
  } = useStrawberryDetection();
  const [busy, setBusy] = useState(false);
  const [localHint, setLocalHint] = useState(null);
  const bitmapRef = useRef(null);
  const canvasRef = useRef(null);

  const revokePreview = useCallback(() => {
    if (bitmapRef.current) {
      bitmapRef.current.close?.();
      bitmapRef.current = null;
    }
  }, []);

  const onFileChange = useCallback(
    async (e) => {
      const f = e.target.files?.[0];
      revokePreview();
      setLocalHint(null);
      if (!f || !f.type.startsWith("image/")) {
        setLocalHint("Elige una imagen RGB (PNG, JPEG, WebP).");
        return;
      }
      try {
        const bmp = await createImageBitmap(f);
        bitmapRef.current = bmp;
        const canvas = canvasRef.current;
        if (canvas) {
          canvas.width = bmp.width;
          canvas.height = bmp.height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(bmp, 0, 0);
          }
        }
        setLocalHint(
          "Imagen lista. Pulsa «Detectar frutos» para ejecutar YOLOv11 (ONNX)."
        );
      } catch {
        setLocalHint("No se pudo leer la imagen.");
      }
    },
    [revokePreview]
  );

  useEffect(() => () => revokePreview(), [revokePreview]);

  const runDetection = useCallback(async () => {
    let tempBmp = null;
    let bmp = spectralRgbBitmap ?? null;
    if (!bmp && spectralRgbBlob) {
      try {
        tempBmp = await createImageBitmap(spectralRgbBlob);
        bmp = tempBmp;
      } catch {
        bmp = null;
      }
    }
    if (!bmp) {
      bmp = bitmapRef.current;
    }
    if (!bmp) {
      setLocalHint(
        "Genera el RGB en modo avanzado (visualización RGB con R+G+B) o sube una imagen aquí."
      );
      return;
    }
    setBusy(true);
    setLocalHint("Cargando modelo e inferencia (escala completa + alta resolución)…");
    try {
      const session = await getOrCreateSession(getDefaultModelUrl());
      const { tensorData, meta } = letterboxToTensor(bmp);
      const boxesBase = await runStrawberryInference(session, tensorData, {
        // Más sensibilidad para frutos pequeños/cercanos.
        confThreshold: 0.10,
        iouThreshold: 0.65,
      });
      const mappedBase = boxesBase.map((b) => mapBoxToOriginal(b, meta));

      // Pasadas por ventanas para elevar resolución efectiva en frutos pequeños.
      const tiles = makeTiles(bmp.width, bmp.height);
      const tileDetections = [];
      for (const tile of tiles) {
        const det = await runInferenceOnCrop(session, bmp, tile, 0.07, 0.70);
        tileDetections.push(...det);
      }

      const mappedMerged = nmsMerge([...mappedBase, ...tileDetections], 0.50);
      const mappedNoShadow = suppressLikelyShadowDetections(mappedMerged, bmp);
      const mapped = enforceDisjointDetections(mappedNoShadow);

      let boxesForUi = mapped;
      let maturityHint = "";
      const fullBands =
        spectralCubeBands?.r &&
        spectralCubeBands?.g &&
        spectralCubeBands?.b &&
        spectralCubeBands?.re &&
        spectralCubeBands?.nir;
      if (mapped.length && fullBands) {
        try {
          const imgR = await loadImageCrossOrigin(spectralCubeBands.r);
          const sx = imgR.width / bmp.width;
          const sy = imgR.height / bmp.height;
          const mappedSpectral = scaleBoxes(mapped, sx, sy);
          const analyzed = await analyzeStrawberryMaturityInBoxes(
            spectralCubeBands,
            mappedSpectral
          );
          boxesForUi = scaleBoxes(analyzed, 1 / sx, 1 / sy).map((b, i) => ({
            ...mapped[i],
            maturity: b.maturity,
            score: b.score,
            indices: b.indices,
          }));
          maturityHint =
            " Madurez por fruto (GNDVI, CIre, SIPI, VARI dentro de cada caja; heurística inicial).";
        } catch (e) {
          const m = e instanceof Error ? e.message : String(e);
          maturityHint = ` No se pudo estimar madurez espectral: ${m}`;
        }
      } else if (mapped.length && !fullBands) {
        maturityHint =
          " Sube o selecciona un cube con las 5 bandas (R,G,B,RE,NIR) en modo avanzado para ver madurez por caja.";
      }

      setDetectionResult(mapped.length, null, {
        boxes: boxesForUi,
        cubeId: spectralCubeSelection?.id ?? null,
        imageWidth: bmp.width,
        imageHeight: bmp.height,
      });

      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = bmp.width;
        canvas.height = bmp.height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(bmp, 0, 0);
          ctx.lineWidth = Math.max(2, Math.round(bmp.width / 400));
          for (const b of boxesForUi) {
            const wBox = b.x2 - b.x1;
            const hBox = b.y2 - b.y1;
            const hasMaturity = Boolean(b.maturity);
            ctx.strokeStyle = hasMaturity
              ? "rgba(34, 197, 94, 0.95)"
              : "rgba(251, 191, 36, 0.95)";
            ctx.fillStyle = hasMaturity
              ? "rgba(34, 197, 94, 0.22)"
              : "rgba(251, 191, 36, 0.18)";
            ctx.strokeRect(b.x1, b.y1, wBox, hBox);
            ctx.fillRect(b.x1, b.y1, wBox, hBox);
            if (hasMaturity) {
              const pad = 4;
              const label = String(b.maturity);
              const fontPx = Math.max(11, Math.round(bmp.width / 120));
              ctx.font = `${fontPx}px system-ui, sans-serif`;
              const metrics = ctx.measureText(label);
              const tw = metrics.width + pad * 2;
              const th = fontPx + pad * 2;
              let lx = b.x1;
              let ly = b.y1 - th - 2;
              if (ly < 2) ly = b.y1 + 2;
              if (lx + tw > bmp.width - 2) lx = Math.max(2, bmp.width - tw - 2);
              ctx.fillStyle = "rgba(15, 23, 42, 0.82)";
              ctx.fillRect(lx, ly, tw, th);
              ctx.fillStyle = "rgb(248, 250, 252)";
              ctx.fillText(label, lx + pad, ly + th - pad - 1);
            }
          }
        }
      }
      setLocalHint(
        mapped.length === 0
          ? "Modelo ejecutado: 0 frutos por encima del umbral de confianza."
          : `Modelo ejecutado: ${mapped.length} fruto(s) detectado(s).${maturityHint}`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setDetectionResult(null, msg);
      setLocalHint(msg);
    } finally {
      tempBmp?.close?.();
      setBusy(false);
    }
  }, [
    setDetectionResult,
    spectralRgbBitmap,
    spectralRgbBlob,
    spectralCubeBands,
    spectralCubeSelection?.id,
  ]);

  return (
    <section
      aria-label="Detección y resultados"
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h2 className="text-xl font-semibold text-slate-900">
        Detección y resultados
      </h2>

      {spectralRgbBitmap ? (
        <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          <span className="font-semibold">RGB multiespectral listo</span> (
          {spectralRgbBitmap.width}×{spectralRgbBitmap.height} px). «Detectar
          frutos» usará esta imagen antes que un archivo subido.
        </p>
      ) : spectralRgbBlob ? (
        <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          <span className="font-semibold">RGB multiespectral listo</span>.
          «Detectar frutos» lo usará aunque no haya bitmap persistido.
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={onFileChange}
          className="text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-600 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-emerald-700"
        />
        <button
          type="button"
          disabled={busy}
          onClick={runDetection}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
        >
          {busy ? "Procesando…" : "Detectar frutos"}
        </button>
      </div>

      <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <span className="font-semibold text-slate-700">Modelo:</span>{" "}
        <code className="rounded bg-white px-1">{getDefaultModelUrl()}</code>{" "}
        (o variable{" "}
        <code className="rounded bg-white px-1">VITE_YOLO_STRAWBERRY_MODEL_URL</code>
        ). Exporta desde Ultralytics con{" "}
        <code className="rounded bg-white px-1">
          format=&quot;onnx&quot;, nms=True, imgsz=640
        </code>
        .
      </p>

      {localHint && (
        <p className="mt-2 text-sm text-slate-600">{localHint}</p>
      )}

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100 bg-slate-950/5 p-2">
        <canvas
          ref={canvasRef}
          className="mx-auto max-h-[min(70vh,520px)] w-auto max-w-full rounded-lg bg-slate-900/10"
        />
        <p className="mt-2 text-center text-[11px] text-slate-400">
          Vista previa y cajas de detección (verde)
        </p>
      </div>

      {children}
    </section>
  );
}
