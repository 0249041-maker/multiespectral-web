import { useStrawberryDetection } from "@/context/StrawberryDetectionContext";
import {
  getDefaultModelUrl,
  getOrCreateSession,
  letterboxToTensor,
  mapBoxToOriginal,
  runStrawberryInference,
} from "@/lib/yoloStrawberry";
import { useCallback, useEffect, useRef, useState } from "react";

export default function StrawberryDetectionLab() {
  const { setDetectionResult } = useStrawberryDetection();
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
    const bmp = bitmapRef.current;
    if (!bmp) {
      setLocalHint("Primero sube una imagen RGB.");
      return;
    }
    setBusy(true);
    setLocalHint("Cargando modelo e inferencia…");
    try {
      const session = await getOrCreateSession(getDefaultModelUrl());
      const { tensorData, meta } = letterboxToTensor(bmp);
      const boxes = await runStrawberryInference(session, tensorData, {
        confThreshold: 0.25,
      });
      const mapped = boxes.map((b) => mapBoxToOriginal(b, meta));
      setDetectionResult(mapped.length, null);

      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = bmp.width;
        canvas.height = bmp.height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(bmp, 0, 0);
          ctx.strokeStyle = "rgba(34, 197, 94, 0.95)";
          ctx.lineWidth = Math.max(2, Math.round(bmp.width / 400));
          ctx.fillStyle = "rgba(34, 197, 94, 0.25)";
          for (const b of mapped) {
            const w = b.x2 - b.x1;
            const h = b.y2 - b.y1;
            ctx.strokeRect(b.x1, b.y1, w, h);
            ctx.fillRect(b.x1, b.y1, w, h);
          }
        }
      }
      setLocalHint(
        mapped.length === 0
          ? "Modelo ejecutado: 0 frutos por encima del umbral de confianza."
          : `Modelo ejecutado: ${mapped.length} fruto(s) detectado(s).`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setDetectionResult(null, msg);
      setLocalHint(msg);
    } finally {
      setBusy(false);
    }
  }, [setDetectionResult]);

  return (
    <section
      aria-label="Pruebas de detección de frutos"
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Pruebas de detección (RGB · YOLOv11 ONNX)
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Sube una imagen <strong>RGB</strong> del cultivo. Se cuenta el total
            de frutos detectados (sin distinguir madurez). El número se refleja
            arriba en modo básico.
          </p>
        </div>
      </div>

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
    </section>
  );
}
