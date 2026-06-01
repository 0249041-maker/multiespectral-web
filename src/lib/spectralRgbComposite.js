/**
 * RGB compuesto a partir de bandas multiespectrales (URLs de imagen).
 * Alinea automáticamente G, B, RE y NIR respecto a R (correlación en miniatura).
 * Con 5 bandas: canal pantalla R = mezcla NIR+R+RE; G y B de bandas alineadas.
 */

const EPS = 1e-9;

/** Miniatura fina para correlación (más detalle = menos ambigüedad). */
const ALIGN_FINE_MAX = 384;
/** Miniatura gruesa para acotar desplazamientos grandes (px del lado). */
const ALIGN_COARSE_MAX = 112;
/** Ventana de búsqueda en la miniatura gruesa (puede cubrir ~40% del lado). */
const ALIGN_COARSE_MAX_SHIFT = 56;
/** Refinamiento alrededor de la estimación gruesa (en píxeles de la miniatura fina). */
const ALIGN_FINE_HALF_WINDOW = 52;
/** Tope de ventana completa en miniatura fina si no hay paso grueso. */
const ALIGN_FINE_FULL_MAX_SHIFT = 96;

function luminanceFromRgba(r, g, b) {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/**
 * @param {string} url
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImageCrossOrigin(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!url.startsWith("blob:") && !url.startsWith("data:")) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error("No se pudo cargar una de las bandas (CORS o URL)."));
    img.src = url;
  });
}

/**
 * @param {HTMLImageElement} img
 * @param {number} tw
 * @param {number} th
 * @returns {ImageData}
 */
export function drawToImageData(img, tw, th) {
  const c = document.createElement("canvas");
  c.width = tw;
  c.height = th;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D no disponible.");
  ctx.drawImage(img, 0, 0, tw, th);
  return ctx.getImageData(0, 0, tw, th);
}

/**
 * @param {ImageData} imageData
 * @returns {Float32Array}
 */
export function imageDataToLuminance(imageData) {
  const { data } = imageData;
  const n = data.length / 4;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    out[i] = luminanceFromRgba(data[o], data[o + 1], data[o + 2]);
  }
  return out;
}

/**
 * Realza contornos para registrar mejor entre bandas con brillo distinto.
 * @param {Float32Array} lum
 * @param {number} w
 * @param {number} h
 */
export function edgeMap(lum, w, h) {
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

/**
 * @param {HTMLImageElement} img
 * @param {number} maxSide
 * @returns {{ lum: Float32Array; sw: number; sh: number }}
 */
export function luminanceDownscaled(img, maxSide) {
  let tw = img.width;
  let th = img.height;
  const scale = Math.min(1, maxSide / Math.max(tw, th));
  tw = Math.max(1, Math.round(tw * scale));
  th = Math.max(1, Math.round(th * scale));
  const id = drawToImageData(img, tw, th);
  return { lum: imageDataToLuminance(id), sw: tw, sh: th };
}

/**
 * Correlación cruzada normalizada; ref(x,y) vs mov(x+dx,y+dy).
 * @param {Float32Array} ref
 * @param {Float32Array} mov
 * @param {number} sw
 * @param {number} sh
 * @param {number} maxShift
 * @returns {{ dx: number; dy: number }}
 */
export function findBestTranslation(ref, mov, sw, sh, maxShift) {
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
  const stdR = Math.sqrt(varR / n) + EPS;
  const stdM = Math.sqrt(varM / n) + EPS;

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

/**
 * Estadísticas globales para NCC (misma convención que findBestTranslation).
 * @param {Float32Array} ref
 * @param {Float32Array} mov
 * @param {number} n
 */
function nccGlobalStats(ref, mov, n) {
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
  const stdR = Math.sqrt(varR / n) + EPS;
  const stdM = Math.sqrt(varM / n) + EPS;
  return { meanR, meanM, stdR, stdM };
}

/**
 * NCC medio en un desplazamiento (ref vs mov desplazado).
 */
function nccAtShift(
  ref,
  mov,
  sw,
  sh,
  dx,
  dy,
  meanR,
  stdR,
  meanM,
  stdM,
  stride
) {
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
  if (count === 0) return -Infinity;
  return sum / count;
}

const W_NCC_EDGE = 0.52;
const W_NCC_LUM = 0.48;

/**
 * Correlación cruzada normalizada combinando bordes y luminancia (menos fallos en zonas uniformes).
 * @param {{ type: "full"; maxShift: number } | { type: "window"; cx: number; cy: number; half: number }} range
 */
function findBestTranslationDual(refEdge, movEdge, refLum, movLum, sw, sh, range) {
  const n = sw * sh;
  const stE = nccGlobalStats(refEdge, movEdge, n);
  const stL = nccGlobalStats(refLum, movLum, n);
  const stride = sw > 120 || sh > 120 ? 2 : 1;

  let loDx;
  let hiDx;
  let loDy;
  let hiDy;
  if (range.type === "full") {
    const m = range.maxShift;
    loDx = -m;
    hiDx = m;
    loDy = -m;
    hiDy = m;
  } else {
    loDx = range.cx - range.half;
    hiDx = range.cx + range.half;
    loDy = range.cy - range.half;
    hiDy = range.cy + range.half;
  }

  let bestScore = -Infinity;
  let bestDx = 0;
  let bestDy = 0;

  for (let dy = loDy; dy <= hiDy; dy++) {
    for (let dx = loDx; dx <= hiDx; dx++) {
      const sE = nccAtShift(
        refEdge,
        movEdge,
        sw,
        sh,
        dx,
        dy,
        stE.meanR,
        stE.stdR,
        stE.meanM,
        stE.stdM,
        stride
      );
      const sL = nccAtShift(
        refLum,
        movLum,
        sw,
        sh,
        dx,
        dy,
        stL.meanR,
        stL.stdR,
        stL.meanM,
        stL.stdM,
        stride
      );
      if (!Number.isFinite(sE) || !Number.isFinite(sL)) continue;
      const score = W_NCC_EDGE * sE + W_NCC_LUM * sL;
      if (score > bestScore) {
        bestScore = score;
        bestDx = dx;
        bestDy = dy;
      }
    }
  }
  return { dx: bestDx, dy: bestDy };
}

/**
 * Desplazamiento mov→ref en píxeles de imagen completa (correlación gruesa + refinamiento fino).
 */
function computeBandShiftVsRef(refImg, movImg, fullW, fullH) {
  const refFine = luminanceDownscaled(refImg, ALIGN_FINE_MAX);
  const { sw: swF, sh: shF, lum: lumRF } = refFine;
  const movLumF = imageDataToLuminance(drawToImageData(movImg, swF, shF));
  const refEdgeF = edgeMap(lumRF, swF, shF);
  const movEdgeF = edgeMap(movLumF, swF, shF);

  const useCoarse = Math.max(fullW, fullH) > ALIGN_COARSE_MAX * 1.2;

  let dxF;
  let dyF;

  if (useCoarse) {
    const refC = luminanceDownscaled(refImg, ALIGN_COARSE_MAX);
    const { sw: swC, sh: shC, lum: lumRC } = refC;
    const movLumC = imageDataToLuminance(drawToImageData(movImg, swC, shC));
    const refEdgeC = edgeMap(lumRC, swC, shC);
    const movEdgeC = edgeMap(movLumC, swC, shC);
    const maxShiftC = Math.min(
      ALIGN_COARSE_MAX_SHIFT,
      Math.max(6, Math.floor(Math.min(swC, shC) / 2) - 2)
    );
    const coarse = findBestTranslationDual(
      refEdgeC,
      movEdgeC,
      lumRC,
      movLumC,
      swC,
      shC,
      { type: "full", maxShift: maxShiftC }
    );
    const cx = Math.round((coarse.dx * swF) / swC);
    const cy = Math.round((coarse.dy * shF) / shC);
    let refined = findBestTranslationDual(
      refEdgeF,
      movEdgeF,
      lumRF,
      movLumF,
      swF,
      shF,
      { type: "window", cx, cy, half: ALIGN_FINE_HALF_WINDOW }
    );
    const hw = ALIGN_FINE_HALF_WINDOW;
    const nearEdge =
      refined.dx <= cx - hw + 2 ||
      refined.dx >= cx + hw - 2 ||
      refined.dy <= cy - hw + 2 ||
      refined.dy >= cy + hw - 2;
    if (nearEdge) {
      const maxShiftF = Math.min(
        ALIGN_FINE_FULL_MAX_SHIFT,
        Math.max(4, Math.floor(Math.min(swF, shF) / 2) - 2)
      );
      refined = findBestTranslationDual(
        refEdgeF,
        movEdgeF,
        lumRF,
        movLumF,
        swF,
        shF,
        { type: "full", maxShift: maxShiftF }
      );
    }
    dxF = refined.dx;
    dyF = refined.dy;
  } else {
    const maxShiftF = Math.min(
      ALIGN_FINE_FULL_MAX_SHIFT,
      Math.max(4, Math.floor(Math.min(swF, shF) / 2) - 2)
    );
    const full = findBestTranslationDual(
      refEdgeF,
      movEdgeF,
      lumRF,
      movLumF,
      swF,
      shF,
      { type: "full", maxShift: maxShiftF }
    );
    dxF = full.dx;
    dyF = full.dy;
  }

  const scaleX = fullW / swF;
  const scaleY = fullH / shF;
  return {
    dx: Math.round(dxF * scaleX),
    dy: Math.round(dyF * scaleY),
  };
}

/**
 * Muestra arr con traslación (misma convención que la correlación: valor en (x,y) = arr[x+dx,y+dy]).
 * @param {Float32Array} arr
 * @param {number} w
 * @param {number} h
 * @param {number} dx
 * @param {number} dy
 */
export function applyShiftFloat32(arr, w, h, dx, dy) {
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const xs = Math.round(x + dx);
      const ys = Math.round(y + dy);
      const xc = Math.max(0, Math.min(w - 1, xs));
      const yc = Math.max(0, Math.min(h - 1, ys));
      out[y * w + x] = arr[yc * w + xc];
    }
  }
  return out;
}

/**
 * @param {Float32Array} arr
 * @returns {Float32Array}
 */
export function normalizeMinMax(arr) {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = max - min;
  const denom = range < EPS ? 1 : range;
  const norm = new Float32Array(arr.length);
  for (let i = 0; i < arr.length; i++) {
    norm[i] = (arr[i] - min) / denom;
  }
  return norm;
}

/**
 * Estirado robusto por percentiles para evitar imágenes oscuras por outliers.
 * @param {Float32Array} arr
 * @param {number} lowQ
 * @param {number} highQ
 * @returns {Float32Array}
 */
export function normalizeRobust(arr, lowQ = 0.01, highQ = 0.99) {
  const n = arr.length;
  if (n === 0) return new Float32Array(0);
  const sampleTarget = Math.min(50000, n);
  const stride = Math.max(1, Math.floor(n / sampleTarget));
  const sample = [];
  for (let i = 0; i < n; i += stride) {
    sample.push(arr[i]);
  }
  sample.sort((a, b) => a - b);
  const loIdx = Math.max(0, Math.min(sample.length - 1, Math.floor((sample.length - 1) * lowQ)));
  const hiIdx = Math.max(0, Math.min(sample.length - 1, Math.floor((sample.length - 1) * highQ)));
  const lo = sample[loIdx];
  const hi = sample[hiIdx];
  const range = hi - lo;
  if (range < EPS * 10) {
    return normalizeMinMax(arr);
  }
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = (arr[i] - lo) / range;
    out[i] = Math.max(0, Math.min(1, t));
  }
  return out;
}

/**
 * Balance de blancos simple (gray-world) para evitar dominantes en RGB natural.
 * @param {Float32Array} r
 * @param {Float32Array} g
 * @param {Float32Array} b
 * @returns {{ r: Float32Array; g: Float32Array; b: Float32Array }}
 */
function balanceRgbChannels(r, g, b) {
  const n = r.length;
  if (!n || g.length !== n || b.length !== n) return { r, g, b };

  let meanR = 0;
  let meanG = 0;
  let meanB = 0;
  for (let i = 0; i < n; i++) {
    meanR += r[i];
    meanG += g[i];
    meanB += b[i];
  }
  meanR /= n;
  meanG /= n;
  meanB /= n;
  const target = (meanR + meanG + meanB) / 3;
  const clampGain = (x) => Math.max(0.72, Math.min(1.38, x));
  const gainR = clampGain(target / (meanR + EPS));
  const gainG = clampGain(target / (meanG + EPS));
  const gainB = clampGain(target / (meanB + EPS));

  const outR = new Float32Array(n);
  const outG = new Float32Array(n);
  const outB = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    outR[i] = Math.max(0, Math.min(1, r[i] * gainR));
    outG[i] = Math.max(0, Math.min(1, g[i] * gainG));
    outB[i] = Math.max(0, Math.min(1, b[i] * gainB));
  }
  return { r: outR, g: outG, b: outB };
}

/**
 * Compensa exposición global para evitar RGB muy oscuro.
 * @param {Float32Array} r
 * @param {Float32Array} g
 * @param {Float32Array} b
 * @param {number} targetLum
 * @returns {{ r: Float32Array; g: Float32Array; b: Float32Array }}
 */
function autoExposeRgb(r, g, b, targetLum = 0.46) {
  const n = r.length;
  if (!n || g.length !== n || b.length !== n) return { r, g, b };
  let meanLum = 0;
  const sample = [];
  const stride = Math.max(1, Math.floor(n / 40000));
  for (let i = 0; i < n; i++) {
    const lum = 0.2126 * r[i] + 0.7152 * g[i] + 0.0722 * b[i];
    meanLum += lum;
    if (i % stride === 0) sample.push(lum);
  }
  meanLum /= n;
  sample.sort((a, b) => a - b);
  const p = (q) =>
    sample[
      Math.max(0, Math.min(sample.length - 1, Math.floor((sample.length - 1) * q)))
    ];
  const p50 = sample.length ? p(0.5) : meanLum;
  const p85 = sample.length ? p(0.85) : meanLum;

  // Control robusto: sube sombras/medios, protege altas luces.
  const gainMean = targetLum / (meanLum + EPS);
  const gainMid = 0.5 / (p50 + EPS);
  const hiGuard = 0.93 / (p85 + EPS);
  const rawGain = Math.min(Math.max(gainMean, gainMid), hiGuard * 1.12);
  const gain = Math.max(0.9, Math.min(1.75, rawGain));
  if (Math.abs(gain - 1) < 0.03) return { r, g, b };
  const outR = new Float32Array(n);
  const outG = new Float32Array(n);
  const outB = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    outR[i] = Math.max(0, Math.min(1, r[i] * gain));
    outG[i] = Math.max(0, Math.min(1, g[i] * gain));
    outB[i] = Math.max(0, Math.min(1, b[i] * gain));
  }
  return { r: outR, g: outG, b: outB };
}

/**
 * @param {HTMLImageElement} imgR
 * @param {number} w
 * @param {number} h
 * @returns {(img: HTMLImageElement) => { dx: number; dy: number }}
 */
function makeAlignToRef(imgR, w, h) {
  return function alignToRef(img) {
    return computeBandShiftVsRef(imgR, img, w, h);
  };
}

/**
 * Alinea otras bandas respecto a una imagen de referencia arbitraria (p. ej. G para GNDVI, RE para CIre).
 * @param {HTMLImageElement} refImg
 * @returns {(mov: HTMLImageElement) => { dx: number; dy: number }}
 */
export function createAlignerForReferenceImage(refImg) {
  const w = refImg.width;
  const h = refImg.height;
  return makeAlignToRef(refImg, w, h);
}

function assertSameDimensions(label, img, w, h) {
  if (img.width !== w || img.height !== h) {
    throw new Error(
      `Las dimensiones de la banda ${label} (${img.width}×${img.height}) no coinciden con R (${w}×${h}).`
    );
  }
}

/**
 * Factor por banda para convertir intensidad 0..1 en reflectancia compensada
 * por el blanco. `factor = 255 / compensador` (con `compensador` en 0..255).
 * Si no hay compensador válido devuelve 1 (sin compensación).
 * @param {import("./cubeCompensators").CompensatorsByBand | null | undefined} comp
 */
function buildBandFactors(comp) {
  const factor = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return 1;
    const norm = n / 255;
    return norm > 1e-3 ? 1 / norm : 1;
  };
  return {
    r: factor(comp?.r),
    g: factor(comp?.g),
    b: factor(comp?.b),
    re: factor(comp?.re),
    nir: factor(comp?.nir),
  };
}

/**
 * Reflectancia aproximada por canal (luminancia / 255), alineada a R.
 * Requiere las 5 URLs (R, G, B, RE, NIR).
 *
 * Si se proveen `compensators` (intensidad media 0..255 del blanco por banda),
 * la reflectancia se calcula como:
 *   reflectancia = (luminancia / 255) / (compensador / 255)
 *
 * @param {{ r: string; g: string; b: string; re: string; nir: string }} bandUrls
 * @param {{ compensators?: import("./cubeCompensators").CompensatorsByBand | null }} [options]
 * @returns {Promise<{ w: number; h: number; R: Float32Array; G: Float32Array; B: Float32Array; RE: Float32Array; NIR: Float32Array }>}
 */
export async function computeFiveBandAlignedReflectance(bandUrls, options = {}) {
  const { r, g, b, re, nir } = bandUrls;
  if (!r || !g || !b || !re || !nir) {
    throw new Error("Se requieren las cinco bandas (R, G, B, RE, NIR).");
  }
  const [imgR, imgG, imgB, imgRe, imgNir] = await Promise.all([
    loadImageCrossOrigin(r),
    loadImageCrossOrigin(g),
    loadImageCrossOrigin(b),
    loadImageCrossOrigin(re),
    loadImageCrossOrigin(nir),
  ]);
  const w = imgR.width;
  const h = imgR.height;
  assertSameDimensions("G", imgG, w, h);
  assertSameDimensions("B", imgB, w, h);
  assertSameDimensions("RE", imgRe, w, h);
  assertSameDimensions("NIR", imgNir, w, h);

  const dataR = imageDataToLuminance(drawToImageData(imgR, w, h));
  const dataG0 = imageDataToLuminance(drawToImageData(imgG, w, h));
  const dataB0 = imageDataToLuminance(drawToImageData(imgB, w, h));
  const dataRe0 = imageDataToLuminance(drawToImageData(imgRe, w, h));
  const dataNir0 = imageDataToLuminance(drawToImageData(imgNir, w, h));

  const alignToRef = makeAlignToRef(imgR, w, h);
  const shiftG = alignToRef(imgG);
  const shiftB = alignToRef(imgB);
  const shiftRe = alignToRef(imgRe);
  const shiftNir = alignToRef(imgNir);

  const dataG = applyShiftFloat32(dataG0, w, h, shiftG.dx, shiftG.dy);
  const dataB = applyShiftFloat32(dataB0, w, h, shiftB.dx, shiftB.dy);
  const dataRe = applyShiftFloat32(dataRe0, w, h, shiftRe.dx, shiftRe.dy);
  const dataNir = applyShiftFloat32(dataNir0, w, h, shiftNir.dx, shiftNir.dy);

  const f = buildBandFactors(options.compensators);

  const n = w * h;
  const R = new Float32Array(n);
  const G = new Float32Array(n);
  const B = new Float32Array(n);
  const RE = new Float32Array(n);
  const NIR = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    R[i] = (dataR[i] / 255) * f.r;
    G[i] = (dataG[i] / 255) * f.g;
    B[i] = (dataB[i] / 255) * f.b;
    RE[i] = (dataRe[i] / 255) * f.re;
    NIR[i] = (dataNir[i] / 255) * f.nir;
  }
  return { w, h, R, G, B, RE, NIR };
}

/**
 * R, G, B como reflectancia ~0..1 alineadas a la banda R.
 * Si se proveen `compensators`, multiplica por el factor 255/compensador por banda.
 *
 * @param {{ r: string; g: string; b: string }} bandUrls
 * @param {{ compensators?: import("./cubeCompensators").CompensatorsByBand | null }} [options]
 * @returns {Promise<{ w: number; h: number; R: Float32Array; G: Float32Array; B: Float32Array }>}
 */
export async function computeThreeBandAlignedReflectance(bandUrls, options = {}) {
  const { r, g, b } = bandUrls;
  if (!r || !g || !b) {
    throw new Error("Se requieren las bandas R, G y B.");
  }
  const [imgR, imgG, imgB] = await Promise.all([
    loadImageCrossOrigin(r),
    loadImageCrossOrigin(g),
    loadImageCrossOrigin(b),
  ]);
  const w = imgR.width;
  const h = imgR.height;
  assertSameDimensions("G", imgG, w, h);
  assertSameDimensions("B", imgB, w, h);

  const dataR = imageDataToLuminance(drawToImageData(imgR, w, h));
  const dataG0 = imageDataToLuminance(drawToImageData(imgG, w, h));
  const dataB0 = imageDataToLuminance(drawToImageData(imgB, w, h));

  const alignToRef = makeAlignToRef(imgR, w, h);
  const shiftG = alignToRef(imgG);
  const shiftB = alignToRef(imgB);
  const dataG = applyShiftFloat32(dataG0, w, h, shiftG.dx, shiftG.dy);
  const dataB = applyShiftFloat32(dataB0, w, h, shiftB.dx, shiftB.dy);

  const f = buildBandFactors(options.compensators);

  const n = w * h;
  const R = new Float32Array(n);
  const G = new Float32Array(n);
  const B = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    R[i] = (dataR[i] / 255) * f.r;
    G[i] = (dataG[i] / 255) * f.g;
    B[i] = (dataB[i] / 255) * f.b;
  }
  return { w, h, R, G, B };
}

/**
 * Genera un PNG RGB con bandas alineadas a R.
 * - mode="natural": R,G,B directos (estirados).
 * - mode="multispectral": mezcla NIR+R+RE en canal rojo si hay 5 bandas.
 *
 * @param {{ r: string; g: string; b: string; re?: string | null; nir?: string | null }} bandUrls
 * @param {{ mode?: "natural" | "multispectral"; upscaleFactor?: number; gamma?: number }} [options]
 * @returns {Promise<Blob>}
 */
export async function buildSpectralRgbCompositeBlob(bandUrls, options = {}) {
  const mode = options.mode ?? "multispectral";
  const upscaleFactor = Math.max(1, Math.min(3, options.upscaleFactor ?? 2));
  const gamma = Math.max(0.65, Math.min(1.35, options.gamma ?? 0.82));
  const { r, g, b, re, nir } = bandUrls;
  if (!r || !g || !b) {
    throw new Error("Se requieren las bandas R, G y B.");
  }

  const hasFive = Boolean(re && nir);

  const [imgR, imgG, imgB, imgRe, imgNir] = await Promise.all([
    loadImageCrossOrigin(r),
    loadImageCrossOrigin(g),
    loadImageCrossOrigin(b),
    hasFive ? loadImageCrossOrigin(re) : Promise.resolve(null),
    hasFive ? loadImageCrossOrigin(nir) : Promise.resolve(null),
  ]);

  const w = imgR.width;
  const h = imgR.height;

  const dataR = imageDataToLuminance(drawToImageData(imgR, w, h));
  const dataG0 = imageDataToLuminance(drawToImageData(imgG, w, h));
  const dataB0 = imageDataToLuminance(drawToImageData(imgB, w, h));

  const alignToRef = makeAlignToRef(imgR, w, h);

  const shiftG = alignToRef(imgG);
  const shiftB = alignToRef(imgB);

  let dataG = applyShiftFloat32(dataG0, w, h, shiftG.dx, shiftG.dy);
  let dataB = applyShiftFloat32(dataB0, w, h, shiftB.dx, shiftB.dy);

  const rN = normalizeRobust(dataR);
  let gN = normalizeRobust(dataG);
  let bN = normalizeRobust(dataB);

  let outR;

  if (mode === "multispectral" && hasFive && imgRe && imgNir) {
    assertSameDimensions("RE", imgRe, w, h);
    assertSameDimensions("NIR", imgNir, w, h);
    const dataRe0 = imageDataToLuminance(drawToImageData(imgRe, w, h));
    const dataNir0 = imageDataToLuminance(drawToImageData(imgNir, w, h));
    const shiftRe = alignToRef(imgRe);
    const shiftNir = alignToRef(imgNir);
    const dataRe = applyShiftFloat32(dataRe0, w, h, shiftRe.dx, shiftRe.dy);
    const dataNir = applyShiftFloat32(dataNir0, w, h, shiftNir.dx, shiftNir.dy);
    const reN = normalizeRobust(dataRe);
    const nirN = normalizeRobust(dataNir);
    const n = rN.length;
    outR = new Float32Array(n);
    const wNir = 0.45;
    const wRed = 0.35;
    const wRe = 0.2;
    for (let i = 0; i < n; i++) {
      outR[i] = wNir * nirN[i] + wRed * rN[i] + wRe * reN[i];
    }
  } else {
    outR = rN;
  }

  // RGB natural: corregimos dominante de color tras la normalización por banda.
  if (mode === "natural") {
    const balanced = balanceRgbChannels(outR, gN, bN);
    const exposed = autoExposeRgb(balanced.r, balanced.g, balanced.b, 0.47);
    outR = exposed.r;
    gN = exposed.g;
    bN = exposed.b;
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D no disponible.");
  const imgOut = ctx.createImageData(w, h);
  const d = imgOut.data;
  const n = w * h;

  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const rr = Math.round(Math.min(255, Math.max(0, Math.pow(outR[i], gamma) * 255)));
    const gg = Math.round(Math.min(255, Math.max(0, Math.pow(gN[i], gamma) * 255)));
    const bb = Math.round(Math.min(255, Math.max(0, Math.pow(bN[i], gamma) * 255)));
    d[o] = rr;
    d[o + 1] = gg;
    d[o + 2] = bb;
    d[o + 3] = 255;
  }

  ctx.putImageData(imgOut, 0, 0);

  const targetCanvas = document.createElement("canvas");
  targetCanvas.width = Math.max(1, Math.round(w * upscaleFactor));
  targetCanvas.height = Math.max(1, Math.round(h * upscaleFactor));
  const targetCtx = targetCanvas.getContext("2d");
  if (!targetCtx) throw new Error("Canvas 2D no disponible.");
  targetCtx.imageSmoothingEnabled = true;
  targetCtx.imageSmoothingQuality = "high";
  targetCtx.drawImage(canvas, 0, 0, targetCanvas.width, targetCanvas.height);

  const blob = await new Promise((resolve, reject) => {
    targetCanvas.toBlob(
      (bl) => {
        if (bl) resolve(bl);
        else reject(new Error("No se pudo generar el PNG RGB compuesto."));
      },
      "image/png",
      0.95
    );
  });

  return blob;
}
