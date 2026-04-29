/**
 * NDVI en el navegador: (NIR - R) / (NIR + R).
 * Las imágenes deben estar alineadas y con las mismas dimensiones.
 */

const EPS = 1e-6;
const ALIGN_PREVIEW_MAX = 224;
const ALIGN_MAX_SHIFT = 72;

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

/** Luminancia 0..1 (útil si la captura viene como PNG en escala de grises o RGB). */
function luminanceFromRgba(r, g, b) {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function drawImageData(img, w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D no disponible.");
  ctx.drawImage(img, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

function imageDataToLuminance(imageData) {
  const { data } = imageData;
  const n = data.length / 4;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    out[i] = luminanceFromRgba(data[o], data[o + 1], data[o + 2]);
  }
  return out;
}

function edgeMap(lum, w, h) {
  const out = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = lum[i + 1] - lum[i - 1];
      const gy = lum[i + w] - lum[i - w];
      out[i] = Math.sqrt(gx * gx + gy * gy);
    }
  }
  return out;
}

function luminanceDownscaled(img, maxSide) {
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const sw = Math.max(1, Math.round(img.width * scale));
  const sh = Math.max(1, Math.round(img.height * scale));
  return { lum: imageDataToLuminance(drawImageData(img, sw, sh)), sw, sh };
}

function findBestTranslation(ref, mov, sw, sh, maxShift) {
  const n = sw * sh;
  let meanR = 0;
  let meanM = 0;
  for (let i = 0; i < n; i++) {
    meanR += ref[i];
    meanM += mov[i];
  }
  meanR /= n;
  meanM /= n;

  let varR = 0;
  let varM = 0;
  for (let i = 0; i < n; i++) {
    const dr = ref[i] - meanR;
    const dm = mov[i] - meanM;
    varR += dr * dr;
    varM += dm * dm;
  }
  const stdR = Math.sqrt(varR / n) + 1e-9;
  const stdM = Math.sqrt(varM / n) + 1e-9;

  let bestScore = -Infinity;
  let bestDx = 0;
  let bestDy = 0;
  const stride = sw > 96 || sh > 96 ? 2 : 1;

  for (let dy = -maxShift; dy <= maxShift; dy++) {
    for (let dx = -maxShift; dx <= maxShift; dx++) {
      let sum = 0;
      let count = 0;
      for (let y = 0; y < sh; y += stride) {
        const ys = y + dy;
        if (ys < 0 || ys >= sh) continue;
        for (let x = 0; x < sw; x += stride) {
          const xs = x + dx;
          if (xs < 0 || xs >= sw) continue;
          const ir = y * sw + x;
          const im = ys * sw + xs;
          const vr = (ref[ir] - meanR) / stdR;
          const vm = (mov[im] - meanM) / stdM;
          sum += vr * vm;
          count++;
        }
      }
      if (count === 0) continue;
      const score = sum / count;
      if (score > bestScore) {
        bestScore = score;
        bestDx = dx;
        bestDy = dy;
      }
    }
  }
  return { dx: bestDx, dy: bestDy };
}

function applyShiftLuminance(srcLum, w, h, dx, dy) {
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const xs = Math.round(x + dx);
      const ys = Math.round(y + dy);
      const xc = Math.max(0, Math.min(w - 1, xs));
      const yc = Math.max(0, Math.min(h - 1, ys));
      out[y * w + x] = srcLum[yc * w + xc];
    }
  }
  return out;
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
 * Núcleo NDVI con alineación NIR→R.
 * @param {HTMLImageElement} redImg
 * @param {HTMLImageElement} nirImg
 * @returns {Promise<{ blob: Blob; stats: { mean: number; min: number; max: number }; width: number; height: number }>}
 */
async function computeNdviFromImages(redImg, nirImg) {
  if (redImg.width !== nirImg.width || redImg.height !== nirImg.height) {
    throw new Error(
      `Las imágenes deben tener el mismo tamaño (R: ${redImg.width}×${redImg.height}, NIR: ${nirImg.width}×${nirImg.height}).`
    );
  }

  const w = redImg.width;
  const h = redImg.height;

  const redLum = imageDataToLuminance(drawImageData(redImg, w, h));
  const nirLumRaw = imageDataToLuminance(drawImageData(nirImg, w, h));

  const refSmall = luminanceDownscaled(redImg, ALIGN_PREVIEW_MAX);
  const movSmall = imageDataToLuminance(
    drawImageData(nirImg, refSmall.sw, refSmall.sh)
  );
  const refEdges = edgeMap(refSmall.lum, refSmall.sw, refSmall.sh);
  const movEdges = edgeMap(movSmall, refSmall.sw, refSmall.sh);
  const maxShift = Math.min(
    ALIGN_MAX_SHIFT,
    Math.max(4, Math.floor(Math.min(refSmall.sw, refSmall.sh) / 2) - 2)
  );
  const shift = findBestTranslation(
    refEdges,
    movEdges,
    refSmall.sw,
    refSmall.sh,
    maxShift
  );
  const dxFull = Math.round((shift.dx * w) / refSmall.sw);
  const dyFull = Math.round((shift.dy * h) / refSmall.sh);
  const nirLum = applyShiftLuminance(nirLumRaw, w, h, dxFull, dyFull);

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
    const rVal = redLum[i];
    const nVal = nirLum[i];
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
 * @returns {Promise<{ blob: Blob; stats: { mean: number; min: number; max: number }; width: number; height: number }>}
 */
export async function computeNdviPngFromFiles(redFile, nirFile) {
  const [redImg, nirImg] = await Promise.all([
    loadImageFromFile(redFile),
    loadImageFromFile(nirFile),
  ]);
  return computeNdviFromImages(redImg, nirImg);
}

/**
 * NDVI desde URLs de bandas (útil para recalcular al visualizar cubes ya guardados).
 * @param {string} redUrl
 * @param {string} nirUrl
 */
export async function computeNdviPngFromUrls(redUrl, nirUrl) {
  const [redImg, nirImg] = await Promise.all([
    loadImageFromUrl(redUrl),
    loadImageFromUrl(nirUrl),
  ]);
  return computeNdviFromImages(redImg, nirImg);
}
