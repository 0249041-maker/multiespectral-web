/**
 * NDVI en el navegador: (NIR - R) / (NIR + R).
 * La alineación NIR→R usa la misma implementación que RGB y demás índices
 * (`createAlignerForReferenceImage` en spectralRgbComposite.js).
 */

import {
  applyShiftFloat32,
  createAlignerForReferenceImage,
  drawToImageData,
  imageDataToLuminance,
} from "@/lib/spectralRgbComposite";

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

/**
 * @param {string} url
 * @returns {Promise<HTMLImageElement>}
 */
function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!url.startsWith("blob:") && !url.startsWith("data:")) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo cargar la imagen remota."));
    img.src = url;
  });
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
 * Factor de compensación por banda: `factor = 255 / compensador`. Si no es
 * válido, devuelve 1 (sin compensar).
 * @param {number | null | undefined} comp valor 0..255
 */
function compFactor(comp) {
  const n = Number(comp);
  if (!Number.isFinite(n) || n <= 0) return 1;
  const norm = n / 255;
  return norm > 1e-3 ? 1 / norm : 1;
}

/**
 * Núcleo NDVI con alineación NIR→R (idéntica a composición RGB / índices).
 * Si se proveen `compensators` (intensidad media 0..255 del blanco por banda),
 * se aplica `NIR_C = NIR/(comp.nir/255)` y `R_C = R/(comp.r/255)` antes del NDVI.
 * @param {HTMLImageElement} redImg
 * @param {HTMLImageElement} nirImg
 * @param {{ compensators?: import("./cubeCompensators").CompensatorsByBand | null }} [options]
 * @returns {Promise<{ blob: Blob; stats: { mean: number; min: number; max: number }; width: number; height: number }>}
 */
async function computeNdviFromImages(redImg, nirImg, options = {}) {
  if (redImg.width !== nirImg.width || redImg.height !== nirImg.height) {
    throw new Error(
      `Las imágenes deben tener el mismo tamaño (R: ${redImg.width}×${redImg.height}, NIR: ${nirImg.width}×${nirImg.height}).`
    );
  }

  const w = redImg.width;
  const h = redImg.height;

  const redLum = imageDataToLuminance(drawToImageData(redImg, w, h));
  const nirLumRaw = imageDataToLuminance(drawToImageData(nirImg, w, h));

  const alignToRef = createAlignerForReferenceImage(redImg);
  const shift = alignToRef(nirImg);
  const nirLum = applyShiftFloat32(nirLumRaw, w, h, shift.dx, shift.dy);

  const fR = compFactor(options.compensators?.r);
  const fNir = compFactor(options.compensators?.nir);

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
    const rVal = redLum[i] * fR;
    const nVal = nirLum[i] * fNir;
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

/**
 * @param {File} redFile
 * @param {File} nirFile
 * @param {{ compensators?: import("./cubeCompensators").CompensatorsByBand | null }} [options]
 * @returns {Promise<{ blob: Blob; stats: { mean: number; min: number; max: number }; width: number; height: number }>}
 */
export async function computeNdviPngFromFiles(redFile, nirFile, options = {}) {
  const [redImg, nirImg] = await Promise.all([
    loadImageFromFile(redFile),
    loadImageFromFile(nirFile),
  ]);
  return computeNdviFromImages(redImg, nirImg, options);
}

/**
 * NDVI desde URLs de bandas (útil para recalcular al visualizar cubes ya guardados).
 * @param {string} redUrl
 * @param {string} nirUrl
 * @param {{ compensators?: import("./cubeCompensators").CompensatorsByBand | null }} [options]
 */
export async function computeNdviPngFromUrls(redUrl, nirUrl, options = {}) {
  const [redImg, nirImg] = await Promise.all([
    loadImageFromUrl(redUrl),
    loadImageFromUrl(nirUrl),
  ]);
  return computeNdviFromImages(redImg, nirImg, options);
}
