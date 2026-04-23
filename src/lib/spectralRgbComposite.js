/**
 * RGB compuesto a partir de bandas multiespectrales (URLs de imagen).
 * Alinea automáticamente G, B, RE y NIR respecto a R (correlación en miniatura).
 * Con 5 bandas: canal pantalla R = mezcla NIR+R+RE; G y B de bandas alineadas.
 */

const EPS = 1e-9;

/** Tamaño máximo del lado en la correlación (velocidad vs precisión). */
const ALIGN_PREVIEW_MAX = 160;
/** Búsqueda de desplazamiento en píxeles (imagen reducida). */
const ALIGN_MAX_SHIFT = 28;

function luminanceFromRgba(r, g, b) {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/**
 * @param {string} url
 * @returns {Promise<HTMLImageElement>}
 */
function loadImageCrossOrigin(url) {
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
function drawToImageData(img, tw, th) {
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

/**
 * @param {HTMLImageElement} img
 * @param {number} maxSide
 * @returns {{ lum: Float32Array; sw: number; sh: number }}
 */
function luminanceDownscaled(img, maxSide) {
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
 * Muestra arr con traslación (misma convención que la correlación: valor en (x,y) = arr[x+dx,y+dy]).
 * @param {Float32Array} arr
 * @param {number} w
 * @param {number} h
 * @param {number} dx
 * @param {number} dy
 */
function applyShiftFloat32(arr, w, h, dx, dy) {
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
function normalizeMinMax(arr) {
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
 * Genera un PNG compuesto RGB con bandas alineadas a R.
 *
 * @param {{ r: string; g: string; b: string; re?: string | null; nir?: string | null }} bandUrls
 * @returns {Promise<Blob>}
 */
export async function buildSpectralRgbCompositeBlob(bandUrls) {
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

  const refSmall = luminanceDownscaled(imgR, ALIGN_PREVIEW_MAX);

  function alignToRef(img) {
    const { sw, sh } = refSmall;
    const movLum = imageDataToLuminance(drawToImageData(img, sw, sh));
    const maxShift = Math.min(
      ALIGN_MAX_SHIFT,
      Math.floor(Math.min(sw, sh) / 5)
    );
    const { dx, dy } = findBestTranslation(
      refSmall.lum,
      movLum,
      sw,
      sh,
      maxShift
    );
    const scaleX = w / sw;
    const scaleY = h / sh;
    const dxFull = Math.round(dx * scaleX);
    const dyFull = Math.round(dy * scaleY);
    return { dx: dxFull, dy: dyFull };
  }

  const shiftG = alignToRef(imgG);
  const shiftB = alignToRef(imgB);

  let dataG = applyShiftFloat32(dataG0, w, h, shiftG.dx, shiftG.dy);
  let dataB = applyShiftFloat32(dataB0, w, h, shiftB.dx, shiftB.dy);

  const rN = normalizeMinMax(dataR);
  let gN = normalizeMinMax(dataG);
  let bN = normalizeMinMax(dataB);

  let outR;

  if (hasFive && imgRe && imgNir) {
    const dataRe0 = imageDataToLuminance(drawToImageData(imgRe, w, h));
    const dataNir0 = imageDataToLuminance(drawToImageData(imgNir, w, h));
    const shiftRe = alignToRef(imgRe);
    const shiftNir = alignToRef(imgNir);
    const dataRe = applyShiftFloat32(dataRe0, w, h, shiftRe.dx, shiftRe.dy);
    const dataNir = applyShiftFloat32(dataNir0, w, h, shiftNir.dx, shiftNir.dy);
    const reN = normalizeMinMax(dataRe);
    const nirN = normalizeMinMax(dataNir);
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
    const rr = Math.round(Math.min(255, Math.max(0, outR[i] * 255)));
    const gg = Math.round(Math.min(255, Math.max(0, gN[i] * 255)));
    const bb = Math.round(Math.min(255, Math.max(0, bN[i] * 255)));
    d[o] = rr;
    d[o + 1] = gg;
    d[o + 2] = bb;
    d[o + 3] = 255;
  }

  ctx.putImageData(imgOut, 0, 0);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
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
