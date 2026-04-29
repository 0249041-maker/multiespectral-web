/**
 * Compensación radiométrica simple usando referencia blanca por banda.
 * Para cada píxel: corrected = sample / (white + eps), con normalización robusta.
 */

const EPS = 1e-6;
const MAX_RATIO = 4;

function loadImageFromBlob(blob) {
  return new Promise((resolve, reject) => {
    const u = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(u);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(u);
      reject(new Error("No se pudo cargar una imagen para compensación."));
    };
    img.src = u;
  });
}

function luminanceFromRgba(r, g, b) {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function drawLuminance(img, w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D no disponible.");
  ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  const out = new Float32Array(w * h);
  for (let i = 0; i < out.length; i++) {
    const o = i * 4;
    out[i] = luminanceFromRgba(data[o], data[o + 1], data[o + 2]);
  }
  return out;
}

function percentileRef(values, p = 0.995) {
  const bins = new Uint32Array(1024);
  const n = values.length;
  for (let i = 0; i < n; i++) {
    const v = Math.max(0, Math.min(MAX_RATIO, values[i]));
    const b = Math.min(1023, Math.floor((v / MAX_RATIO) * 1024));
    bins[b]++;
  }
  const target = Math.max(1, Math.floor(n * p));
  let acc = 0;
  for (let b = 0; b < bins.length; b++) {
    acc += bins[b];
    if (acc >= target) {
      const ref = (b / (bins.length - 1)) * MAX_RATIO;
      return Math.max(0.2, ref);
    }
  }
  return 1;
}

async function compensateOneBand(sampleBlob, whiteBlob) {
  const [sampleImg, whiteImg] = await Promise.all([
    loadImageFromBlob(sampleBlob),
    loadImageFromBlob(whiteBlob),
  ]);
  if (
    sampleImg.width !== whiteImg.width ||
    sampleImg.height !== whiteImg.height
  ) {
    throw new Error(
      `Referencia blanca con tamaño distinto (${sampleImg.width}x${sampleImg.height} vs ${whiteImg.width}x${whiteImg.height}).`
    );
  }
  const w = sampleImg.width;
  const h = sampleImg.height;
  const sampleLum = drawLuminance(sampleImg, w, h);
  const whiteLum = drawLuminance(whiteImg, w, h);

  const n = w * h;
  const ratios = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    ratios[i] = Math.min(MAX_RATIO, sampleLum[i] / (whiteLum[i] + EPS));
  }
  const ref = percentileRef(ratios, 0.995);

  const outCanvas = document.createElement("canvas");
  outCanvas.width = w;
  outCanvas.height = h;
  const outCtx = outCanvas.getContext("2d");
  if (!outCtx) throw new Error("Canvas 2D no disponible.");
  const out = outCtx.createImageData(w, h);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const v = Math.max(0, Math.min(1, ratios[i] / ref));
    const g = Math.round(v * 255);
    out.data[o] = g;
    out.data[o + 1] = g;
    out.data[o + 2] = g;
    out.data[o + 3] = 255;
  }
  outCtx.putImageData(out, 0, 0);

  const blob = await new Promise((resolve, reject) => {
    outCanvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error("No se pudo generar imagen compensada."));
      },
      "image/png",
      0.95
    );
  });
  return blob;
}

/**
 * @param {{ r?: Blob; g?: Blob; b?: Blob; re?: Blob; nir?: Blob }} files
 * @param {{ r?: Blob; g?: Blob; b?: Blob; re?: Blob; nir?: Blob }} whiteRefs
 */
export async function compensateBandsWithWhiteReference(files, whiteRefs = {}) {
  const out = { ...files };
  let compensatedCount = 0;
  for (const key of ["r", "g", "b", "re", "nir"]) {
    if (!files[key]) continue;
    if (!whiteRefs[key]) continue;
    out[key] = await compensateOneBand(files[key], whiteRefs[key]);
    compensatedCount++;
  }
  return { files: out, compensatedCount };
}

