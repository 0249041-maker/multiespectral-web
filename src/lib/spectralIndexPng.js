/**
 * Índices de vegetación calculados en cliente desde URLs de bandas (con alineación).
 * Fórmulas según especificación: GNDVI, CIre (CI_re), SIPI, VARI.
 */

import { ndviToRgb } from "@/lib/ndvi";
import {
  applyShiftFloat32,
  computeFiveBandAlignedReflectance,
  computeThreeBandAlignedReflectance,
  createAlignerForReferenceImage,
  drawToImageData,
  imageDataToLuminance,
  loadImageCrossOrigin,
} from "@/lib/spectralRgbComposite";

const EPS = 1e-6;

/**
 * Umbral mínimo para |denominador| frente a ~0.
 * Un corte absoluto grande (p. ej. 0.02) deja casi todo NaN en SIPI/VARI → mapa negro.
 */
function minDenomMagnitude(scaleSum) {
  return Math.max(EPS, 2.5e-4 * (scaleSum + 0.04));
}

/** Píxeles sin valor (transparente en la práctica: color distintivo). */
const INVALID_RGB = [48, 32, 64];

/** @param {HTMLImageElement} a @param {HTMLImageElement} b */
function assertSameDimensionsImages(a, b, labelA, labelB) {
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error(
      `${labelA} (${a.width}×${a.height}) y ${labelB} (${b.width}×${b.height}) deben tener el mismo tamaño.`
    );
  }
}

function collectStats(values) {
  let sum = 0;
  let count = 0;
  let minV = Infinity;
  let maxV = -Infinity;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (!Number.isFinite(v)) continue;
    sum += v;
    count++;
    if (v < minV) minV = v;
    if (v > maxV) maxV = v;
  }
  if (count === 0) {
    return { mean: 0, min: 0, max: 0, count: 0 };
  }
  return { mean: sum / count, min: minV, max: maxV, count };
}

/**
 * Percentiles robustos sobre valores finitos (con muestreo para rendimiento).
 * @param {Float32Array} values
 * @param {number} lowQ
 * @param {number} highQ
 */
function robustRange(values, lowQ = 0.02, highQ = 0.98) {
  const finite = [];
  const n = values.length;
  if (n === 0) return { minV: 0, maxV: 1 };
  const target = Math.min(50000, n);
  const stride = Math.max(1, Math.floor(n / target));
  for (let i = 0; i < n; i += stride) {
    const v = values[i];
    if (Number.isFinite(v)) finite.push(v);
  }
  if (finite.length === 0) return { minV: 0, maxV: 1 };
  finite.sort((a, b) => a - b);
  const pick = (q) =>
    finite[
      Math.max(
        0,
        Math.min(finite.length - 1, Math.floor((finite.length - 1) * q))
      )
    ];
  const lo = pick(lowQ);
  const hi = pick(highQ);
  if (!(hi > lo)) {
    return { minV: finite[0], maxV: finite[finite.length - 1] };
  }
  return { minV: lo, maxV: hi };
}

/**
 * @param {number} v
 * @param {number} minV
 * @param {number} maxV
 */
function stretchedToRgb(v, minV, maxV) {
  if (!Number.isFinite(v)) return INVALID_RGB;
  const t = maxV <= minV ? 0.5 : (v - minV) / (maxV - minV);
  return ndviToRgb(2 * Math.max(0, Math.min(1, t)) - 1);
}

/**
 * @param {Float32Array} values
 * @param {number} w
 * @param {number} h
 * @param {(v: number, i: number) => [number, number, number]} colorize
 */
async function valuesToPngBlob(values, w, h, colorize) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D no disponible.");
  const imgOut = ctx.createImageData(w, h);
  const d = imgOut.data;
  const n = w * h;
  for (let i = 0; i < n; i++) {
    const v = values[i];
    const o = i * 4;
    const [cr, cg, cb] = colorize(v, i);
    d[o] = cr;
    d[o + 1] = cg;
    d[o + 2] = cb;
    d[o + 3] = 255;
  }
  ctx.putImageData(imgOut, 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("No se pudo generar el PNG del índice."));
      },
      "image/png",
      0.95
    );
  });
}

/**
 * @param {Record<string, string | undefined>} bands
 * @param {"GNDVI" | "CI_re" | "SIPI" | "VARI"} visualization
 * @returns {Promise<{ blob: Blob; stats: { mean: number; min: number; max: number }; width: number; height: number }>}
 */
export async function computeSpectralIndexPngFromBands(bands, visualization) {
  const fullFive = Boolean(
    bands?.r && bands?.g && bands?.b && bands?.re && bands?.nir
  );

  let w;
  let h;
  /** @type {Float32Array} */
  let values;
  const useStretch =
    visualization === "CI_re" || visualization === "SIPI";

  if (visualization === "VARI") {
    if (!bands?.r || !bands?.g || !bands?.b) {
      throw new Error(
        "VARI = (G−R)/(G+R−B): necesitas las bandas R, G y B (no requiere NIR)."
      );
    }
    const o = await computeThreeBandAlignedReflectance({
      r: bands.r,
      g: bands.g,
      b: bands.b,
    });
    w = o.w;
    h = o.h;
    const n = w * h;
    values = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const R = o.R[i];
      const Gch = o.G[i];
      const Bch = o.B[i];
      const den = Gch + R - Bch;
      if (Math.abs(den) < minDenomMagnitude(Gch + R + Bch)) {
        values[i] = NaN;
        continue;
      }
      let v = (Gch - R) / den;
      if (v < -1) v = -1;
      if (v > 1) v = 1;
      values[i] = v;
    }
  } else if (visualization === "GNDVI") {
    if (fullFive) {
      const o = await computeFiveBandAlignedReflectance(
        /** @type {{ r: string; g: string; b: string; re: string; nir: string }} */ (
          bands
        )
      );
      w = o.w;
      h = o.h;
      const n = w * h;
      values = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const N = o.NIR[i];
        const Gch = o.G[i];
        let v = (N - Gch) / (N + Gch + EPS);
        if (v < -1) v = -1;
        if (v > 1) v = 1;
        values[i] = v;
      }
    } else if (bands?.g && bands?.nir) {
      const [imgG, imgN] = await Promise.all([
        loadImageCrossOrigin(bands.g),
        loadImageCrossOrigin(bands.nir),
      ]);
      assertSameDimensionsImages(imgG, imgN, "G (referencia)", "NIR");
      const gw = imgG.width;
      const gh = imgG.height;
      const lumG = imageDataToLuminance(drawToImageData(imgG, gw, gh));
      const lumN0 = imageDataToLuminance(drawToImageData(imgN, gw, gh));
      const align = createAlignerForReferenceImage(imgG);
      const sh = align(imgN);
      const lumN = applyShiftFloat32(lumN0, gw, gh, sh.dx, sh.dy);
      w = gw;
      h = gh;
      const n = w * h;
      values = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const Gch = lumG[i] / 255;
        const N = lumN[i] / 255;
        let v = (N - Gch) / (N + Gch + EPS);
        if (v < -1) v = -1;
        if (v > 1) v = 1;
        values[i] = v;
      }
    } else {
      throw new Error(
        "GNDVI = (NIR−G)/(NIR+G): necesitas G y NIR, o un cube con las 5 bandas."
      );
    }
  } else if (visualization === "CI_re") {
    if (fullFive) {
      const o = await computeFiveBandAlignedReflectance(
        /** @type {{ r: string; g: string; b: string; re: string; nir: string }} */ (
          bands
        )
      );
      w = o.w;
      h = o.h;
      const n = w * h;
      values = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const re = Math.max(o.RE[i], EPS);
        values[i] = o.NIR[i] / re - 1;
      }
    } else if (bands?.re && bands?.nir) {
      const [imgRe, imgN] = await Promise.all([
        loadImageCrossOrigin(bands.re),
        loadImageCrossOrigin(bands.nir),
      ]);
      assertSameDimensionsImages(imgRe, imgN, "RE (referencia)", "NIR");
      const rw = imgRe.width;
      const rh = imgRe.height;
      const lumRe = imageDataToLuminance(drawToImageData(imgRe, rw, rh));
      const lumN0 = imageDataToLuminance(drawToImageData(imgN, rw, rh));
      const align = createAlignerForReferenceImage(imgRe);
      const sh = align(imgN);
      const lumN = applyShiftFloat32(lumN0, rw, rh, sh.dx, sh.dy);
      w = rw;
      h = rh;
      const n = w * h;
      values = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const re = Math.max(lumRe[i] / 255, EPS);
        const N = lumN[i] / 255;
        values[i] = N / re - 1;
      }
    } else {
      throw new Error(
        "CIre = (NIR/RE)−1: necesitas RE y NIR, o un cube con las 5 bandas."
      );
    }
  } else if (visualization === "SIPI") {
    if (fullFive) {
      const o = await computeFiveBandAlignedReflectance(
        /** @type {{ r: string; g: string; b: string; re: string; nir: string }} */ (
          bands
        )
      );
      w = o.w;
      h = o.h;
      const n = w * h;
      values = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const N = o.NIR[i];
        const Rch = o.R[i];
        const Bch = o.B[i];
        const den = N - Rch;
        if (Math.abs(den) < minDenomMagnitude(N + Rch)) {
          values[i] = NaN;
          continue;
        }
        let v = (N - Bch) / den;
        if (v > 20) v = 20;
        if (v < -20) v = -20;
        values[i] = v;
      }
    } else if (bands?.r && bands?.b && bands?.nir) {
      const [imgR, imgB, imgN] = await Promise.all([
        loadImageCrossOrigin(bands.r),
        loadImageCrossOrigin(bands.b),
        loadImageCrossOrigin(bands.nir),
      ]);
      assertSameDimensionsImages(imgR, imgB, "R (referencia)", "B");
      assertSameDimensionsImages(imgR, imgN, "R (referencia)", "NIR");
      const rw = imgR.width;
      const rh = imgR.height;
      const lumR = imageDataToLuminance(drawToImageData(imgR, rw, rh));
      const lumB0 = imageDataToLuminance(drawToImageData(imgB, rw, rh));
      const lumN0 = imageDataToLuminance(drawToImageData(imgN, rw, rh));
      const align = createAlignerForReferenceImage(imgR);
      const shB = align(imgB);
      const shN = align(imgN);
      const lumB = applyShiftFloat32(lumB0, rw, rh, shB.dx, shB.dy);
      const lumN = applyShiftFloat32(lumN0, rw, rh, shN.dx, shN.dy);
      w = rw;
      h = rh;
      const n = w * h;
      values = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const R = lumR[i] / 255;
        const Bch = lumB[i] / 255;
        const N = lumN[i] / 255;
        const den = N - R;
        if (Math.abs(den) < minDenomMagnitude(N + R)) {
          values[i] = NaN;
          continue;
        }
        let v = (N - Bch) / den;
        if (v > 20) v = 20;
        if (v < -20) v = -20;
        values[i] = v;
      }
    } else {
      throw new Error(
        "SIPI = (NIR−B)/(NIR−R): necesitas R, B y NIR, o un cube con las 5 bandas."
      );
    }
  } else {
    throw new Error(`Índice no implementado: ${visualization}`);
  }

  const stats = collectStats(values);
  if (stats.count === 0) {
    const need =
      visualization === "SIPI"
        ? "SIPI necesita R, B y NIR con contraste real entre NIR y R. Si el cube solo tiene R+NIR, sube también B (y el resto) o elige otro índice."
        : visualization === "VARI"
          ? "VARI necesita R, G y B. Si faltan G o B en el cube, este índice no puede calcularse bien."
          : "No hay píxeles válidos para este índice.";
    throw new Error(need);
  }
  const stretchedRange = useStretch
    ? robustRange(values, 0.02, 0.98)
    : { minV: stats.min, maxV: stats.max };
  const { minV, maxV } = stretchedRange;

  const blob = await valuesToPngBlob(values, w, h, (v) => {
    if (!Number.isFinite(v)) return INVALID_RGB;
    if (useStretch) {
      return stretchedToRgb(v, minV, maxV);
    }
    const t = Math.max(-1, Math.min(1, v));
    return ndviToRgb(t);
  });

  return {
    blob,
    stats: { mean: stats.mean, min: stats.min, max: stats.max },
    width: w,
    height: h,
  };
}
