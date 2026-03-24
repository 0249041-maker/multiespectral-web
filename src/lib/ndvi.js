/**
 * NDVI en el navegador: (NIR - R) / (NIR + R).
 * Las imágenes deben estar alineadas y con las mismas dimensiones.
 */

const EPS = 1e-6;

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo cargar la imagen."));
    };
    img.src = url;
  });
}

/** Luminancia 0..1 (útil si la captura viene como PNG en escala de grises o RGB). */
function luminanceFromRgba(r, g, b) {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/**
 * Colormap estilo RdYlGn: NDVI -1 → rojo, 0 → amarillo claro, +1 → verde.
 * @param {number} ndvi en [-1, 1]
 */
export function ndviToRgb(ndvi) {
  const t = Math.max(0, Math.min(1, (ndvi + 1) / 2));
  let r;
  let g;
  let b;

  if (t < 0.25) {
    const k = t / 0.25;
    r = Math.round(139 + (215 - 139) * k);
    g = Math.round(0 + (48 - 0) * k);
    b = Math.round(0 + (39 - 0) * k);
  } else if (t < 0.5) {
    const k = (t - 0.25) / 0.25;
    r = Math.round(215 + (255 - 215) * k);
    g = Math.round(48 + (215 - 48) * k);
    b = Math.round(39 + (79 - 39) * k);
  } else if (t < 0.75) {
    const k = (t - 0.5) / 0.25;
    r = Math.round(255 + (199 - 255) * k);
    g = Math.round(215 + (233 - 215) * k);
    b = Math.round(79 + (180 - 79) * k);
  } else {
    const k = (t - 0.75) / 0.25;
    r = Math.round(199 + (0 - 199) * k);
    g = Math.round(233 + (109 - 233) * k);
    b = Math.round(180 + (44 - 180) * k);
  }

  return [r, g, b];
}

/**
 * @param {File} redFile
 * @param {File} nirFile
 * @returns {Promise<{ blob: Blob; stats: { mean: number; min: number; max: number }; width: number; height: number }>}
 */
export async function computeNdviPngFromFiles(redFile, nirFile) {
  const [redImg, nirImg] = await Promise.all([
    loadImageFromFile(redFile),
    loadImageFromFile(nirFile),
  ]);

  if (redImg.width !== nirImg.width || redImg.height !== nirImg.height) {
    throw new Error(
      `Las imágenes deben tener el mismo tamaño (R: ${redImg.width}×${redImg.height}, NIR: ${nirImg.width}×${nirImg.height}).`
    );
  }

  const w = redImg.width;
  const h = redImg.height;

  const cRed = document.createElement("canvas");
  cRed.width = w;
  cRed.height = h;
  const ctxRed = cRed.getContext("2d", { willReadFrequently: true });
  ctxRed.drawImage(redImg, 0, 0);
  const dataRed = ctxRed.getImageData(0, 0, w, h).data;

  const cNir = document.createElement("canvas");
  cNir.width = w;
  cNir.height = h;
  const ctxNir = cNir.getContext("2d", { willReadFrequently: true });
  ctxNir.drawImage(nirImg, 0, 0);
  const dataNir = ctxNir.getImageData(0, 0, w, h).data;

  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctxOut = out.getContext("2d");
  const imgOut = ctxOut.createImageData(w, h);
  const d = imgOut.data;

  let sum = 0;
  let minV = 1;
  let maxV = -1;
  const n = w * h;

  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const rVal = luminanceFromRgba(dataRed[o], dataRed[o + 1], dataRed[o + 2]);
    const nVal = luminanceFromRgba(dataNir[o], dataNir[o + 1], dataNir[o + 2]);
    let ndvi = (nVal - rVal) / (nVal + rVal + EPS);
    if (ndvi < -1) ndvi = -1;
    if (ndvi > 1) ndvi = 1;
    sum += ndvi;
    if (ndvi < minV) minV = ndvi;
    if (ndvi > maxV) maxV = ndvi;

    const [cr, cg, cb] = ndviToRgb(ndvi);
    d[o] = cr;
    d[o + 1] = cg;
    d[o + 2] = cb;
    d[o + 3] = 255;
  }

  ctxOut.putImageData(imgOut, 0, 0);

  const blob = await new Promise((resolve, reject) => {
    out.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error("No se pudo generar el PNG de NDVI."));
      },
      "image/png",
      0.95
    );
  });

  return {
    blob,
    stats: {
      mean: sum / n,
      min: minV,
      max: maxV,
    },
    width: w,
    height: h,
  };
}
