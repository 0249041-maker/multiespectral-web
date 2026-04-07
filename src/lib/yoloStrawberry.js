import * as ort from "onnxruntime-web";

const DEFAULT_MODEL_PATH =
  import.meta.env.VITE_YOLO_STRAWBERRY_MODEL_URL ??
  "/models/strawberry_yolo_best.onnx";

const INPUT_SIZE = 640;
let ortConfigured = false;
let sessionPromise = null;

function configureOrt() {
  if (ortConfigured) return;
  ort.env.wasm.wasmPaths =
    "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/";
  ort.env.wasm.numThreads = 1;
  ortConfigured = true;
}

/**
 * Letterbox RGB image to INPUT_SIZE, mantiene aspecto, relleno gris 114.
 * @returns {{ tensorData: Float32Array, meta: { scale: number, padX: number, padY: number, origW: number, origH: number } }}
 */
export function letterboxToTensor(imageBitmap) {
  const origW = imageBitmap.width;
  const origH = imageBitmap.height;
  const scale = Math.min(INPUT_SIZE / origW, INPUT_SIZE / origH);
  const newW = Math.round(origW * scale);
  const newH = Math.round(origH * scale);
  const padX = (INPUT_SIZE - newW) / 2;
  const padY = (INPUT_SIZE - newH) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = INPUT_SIZE;
  canvas.height = INPUT_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D no disponible");

  ctx.fillStyle = `rgb(114,114,114)`;
  ctx.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE);
  ctx.drawImage(imageBitmap, padX, padY, newW, newH);

  const imgData = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);
  const { data } = imgData;
  const out = new Float32Array(1 * 3 * INPUT_SIZE * INPUT_SIZE);
  let p = 0;
  for (let c = 0; c < 3; c++) {
    for (let i = 0; i < INPUT_SIZE * INPUT_SIZE; i++) {
      const v = data[i * 4 + c] / 255;
      out[p++] = v;
    }
  }

  return {
    tensorData: out,
    meta: { scale, padX, padY, origW, origH },
  };
}

function iou(a, b) {
  const x1 = Math.max(a.x1, b.x1);
  const y1 = Math.max(a.y1, b.y1);
  const x2 = Math.min(a.x2, b.x2);
  const y2 = Math.min(a.y2, b.y2);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const areaA = (a.x2 - a.x1) * (a.y2 - a.y1);
  const areaB = (b.x2 - b.x1) * (b.y2 - b.y1);
  return inter / (areaA + areaB - inter + 1e-9);
}

function nms(boxes, iouThreshold) {
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

/**
 * Mapa de caja desde coords del modelo (espacio letterbox 640) a imagen original.
 */
export function mapBoxToOriginal(box, meta) {
  const { scale, padX, padY, origW, origH } = meta;
  const x1 = (box.x1 - padX) / scale;
  const y1 = (box.y1 - padY) / scale;
  const x2 = (box.x2 - padX) / scale;
  const y2 = (box.y2 - padY) / scale;
  return {
    x1: clamp(x1, 0, origW),
    y1: clamp(y1, 0, origH),
    x2: clamp(x2, 0, origW),
    y2: clamp(y2, 0, origH),
    score: box.score,
    cls: box.cls,
  };
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * Interpreta salidas típicas de YOLOv8/v11 exportado con Ultralytics `nms=True`.
 * Formas comunes: [1, N, 6] o [1, 6, N] con x1,y1,x2,y2,conf,cls (coords en espacio entrada 640).
 */
function parseNmsEmbeddedOutput(tensor, confThreshold) {
  const data = tensor.data;
  const dims = tensor.dims;
  if (dims.length !== 3) return [];

  let rows = [];
  const [b, d1, d2] = dims;
  if (d2 === 6 || d2 === 7) {
    const n = d1;
    for (let i = 0; i < n; i++) {
      const o = i * d2;
      const x1 = data[o];
      const y1 = data[o + 1];
      const x2 = data[o + 2];
      const y2 = data[o + 3];
      const conf = data[o + 4];
      if (conf < confThreshold) continue;
      rows.push({ x1, y1, x2, y2, score: conf, cls: data[o + 5] ?? 0 });
    }
  } else if (d1 === 6 || d1 === 7) {
    const n = d2;
    for (let i = 0; i < n; i++) {
      const x1 = data[0 * n + i];
      const y1 = data[1 * n + i];
      const x2 = data[2 * n + i];
      const y2 = data[3 * n + i];
      const conf = data[4 * n + i];
      if (conf < confThreshold) continue;
      rows.push({
        x1,
        y1,
        x2,
        y2,
        score: conf,
        cls: data[5 * n + i] ?? 0,
      });
    }
  } else {
    return [];
  }

  return nms(rows, 0.45);
}

function isLikelyRawYoloHead(d1, d2) {
  const large = Math.max(d1, d2);
  const small = Math.min(d1, d2);
  return large > 2000 && small >= 4 && small <= 100;
}

function parseOutputToBoxes(output, confThreshold) {
  const dims = output.dims;
  if (dims.length === 3 && dims[0] === 1) {
    const d1 = dims[1];
    const d2 = dims[2];
    if (isLikelyRawYoloHead(d1, d2)) {
      throw new Error(
        "Este ONNX parece salida cruda (sin NMS). Exporta con Ultralytics: model.export(format='onnx', nms=True, imgsz=640)."
      );
    }
  }
  const boxes = parseNmsEmbeddedOutput(output, confThreshold);
  return boxes;
}

export function getDefaultModelUrl() {
  return DEFAULT_MODEL_PATH;
}

export async function loadStrawberrySession(modelUrl = DEFAULT_MODEL_PATH) {
  configureOrt();
  const url = modelUrl;
  const response = await fetch(url, { method: "GET" });
  if (!response.ok) {
    throw new Error(
      `No se encontró el modelo ONNX (${response.status}). Coloca el archivo en public/models/ o define VITE_YOLO_STRAWBERRY_MODEL_URL.`
    );
  }
  const buf = await response.arrayBuffer();
  const session = await ort.InferenceSession.create(buf, {
    executionProviders: ["wasm"],
    graphOptimizationLevel: "all",
  });
  return session;
}

export function getOrCreateSession(modelUrl) {
  const key = modelUrl || DEFAULT_MODEL_PATH;
  if (!sessionPromise || sessionPromise.url !== key) {
    sessionPromise = { url: key, p: loadStrawberrySession(key) };
  }
  return sessionPromise.p;
}

/**
 * @param {import('onnxruntime-web').InferenceSession} session
 * @param {Float32Array} tensorData NCHW 1x3x640x640
 * @param {{ confThreshold?: number }} opts
 */
export async function runStrawberryInference(session, tensorData, opts = {}) {
  const confThreshold = opts.confThreshold ?? 0.25;
  const inputName = session.inputNames[0];
  const tensor = new ort.Tensor("float32", tensorData, [1, 3, INPUT_SIZE, INPUT_SIZE]);
  const feeds = { [inputName]: tensor };
  const results = await session.run(feeds);

  let lastThrow = null;
  const names = session.outputNames;
  if (!names?.length) {
    throw new Error("El modelo no declara salidas ONNX");
  }

  for (const outName of names) {
    const output = results[outName];
    if (!output) continue;
    try {
      return parseOutputToBoxes(output, confThreshold);
    } catch (e) {
      lastThrow = e instanceof Error ? e : new Error(String(e));
    }
  }

  if (lastThrow) throw lastThrow;
  return [];
}

export { INPUT_SIZE };
