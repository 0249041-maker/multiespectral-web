import { computeFiveBandAlignedReflectance } from "@/lib/spectralRgbComposite";

const EPS = 1e-6;

function minDenomMagnitude(scaleSum) {
  return Math.max(EPS, 2.5e-4 * (scaleSum + 0.04));
}

// Umbrales calibrables de madurez (ajuste manual en campo).
//
// 1) VARI: si en su mayoría los píxeles son “rojos” (no verdes), la base es madura.
// 2) GNDVI, CIre, SIPI (+ voto VARI fuerte): suben a sobremadura o bajan a inmadura. Sin MTCI.
export const DEFAULT_MATURITY_THRESHOLDS = {
  variInmaduraMin: 0.015,
  /** Píxel cuenta como “lado rojo” en VARI si vari ≤ este valor (relajar si el recuento sale bajo). */
  variRedPixelMax: 0.012,
  /** Fracción mínima de píxeles rojos (no sombra) para considerar mayoría roja → madura base. */
  redCoverageForMaduraMin: 0.5,

  variVoteOverripeMax: -0.074,
  gndviVoteOverripeMax: 0.372,
  cireVoteOverripeMax: 0.885,
  sipiVoteOverripeMin: 0.992,

  /** Votos (de 4) para pasar de madura a sobremadura. */
  votesMinSobremadura: 3,
  /**
   * Si los votos “pasados” son como mucho este número y el GNDVI sigue alto,
   * se regresa a inmadura (índices no respaldan rojo maduro).
   */
  votesMaxDowngradeToInmadura: 1,
  /** Junto con pocos votos: GNDVI efectivo por encima sugiere aún mucha clorofila. */
  gndviHighStillGreenMin: 0.438,

  sipiMinForMadura: 1.02,

  greenStrongGndviMin: 0.42,
  greenStrongCireMin: 0.92,
  lowPigmentInmaduraMax: 1.04,
  lowRedInmaduraMin: -0.06,
  veryGreenGndviMin: 0.47,
  veryGreenCireMin: 1.05,
  veryGreenVariMin: -0.075,
};

/** @type {typeof DEFAULT_MATURITY_THRESHOLDS} */
let maturityThresholds = { ...DEFAULT_MATURITY_THRESHOLDS };

/**
 * Devuelve umbrales activos (copia defensiva).
 */
export function getMaturityThresholds() {
  return { ...maturityThresholds };
}

/**
 * Actualiza umbrales activos en runtime.
 * @param {Partial<typeof DEFAULT_MATURITY_THRESHOLDS>} partial
 */
export function setMaturityThresholds(partial = {}) {
  const next = { ...maturityThresholds };
  for (const k of Object.keys(DEFAULT_MATURITY_THRESHOLDS)) {
    if (!(k in partial)) continue;
    const v = partial[k];
    if (typeof v === "number" && Number.isFinite(v)) {
      next[k] = v;
    }
  }
  maturityThresholds = next;
  return getMaturityThresholds();
}

/**
 * Media recortada (percentiles) para reducir sesgo de sombras en un borde del bbox.
 * @param {number[]} values
 * @param {number} trimEachFrac fracción a recortar en cada extremo (0..0.45)
 */
function trimmedMean(values, trimEachFrac = 0.12) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  if (n <= 2) return sorted.reduce((s, v) => s + v, 0) / n;
  const k = Math.min(
    Math.floor(n * trimEachFrac),
    Math.floor((n - 1) / 2)
  );
  let sum = 0;
  let count = 0;
  for (let i = k; i < n - k; i++) {
    sum += sorted[i];
    count++;
  }
  return count ? sum / count : sorted[Math.floor(n / 2)];
}

/**
 * Media de la fracción superior de valores (p. ej. tejido más iluminado en el bbox).
 * Separa maduro con sombra (cola baja, techo alto) de sobremaduro (techo también bajo).
 * @param {number[]} values
 * @param {number} frac fracción del conjunto a tomar desde el máximo (p. ej. 0.28 ≈ ~top 28%)
 */
function upperFractionMean(values, frac = 0.28) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const k = Math.max(1, Math.ceil(n * frac));
  let sum = 0;
  for (let i = n - k; i < n; i++) sum += sorted[i];
  return sum / k;
}

/**
 * Percentil simple sobre arreglo numérico.
 * @param {number[]} values
 * @param {number} q [0..1]
 */
function percentile(values, q) {
  if (!values.length) return 0;
  const qq = Math.max(0, Math.min(1, q));
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * qq)));
  return sorted[idx];
}

/** Etiquetas de madurez por fruto (heurística; calibrar con campo). */
export const MATURITY_CLASSES = /** @type {const} */ ([
  "inmadura",
  "madura",
  "sobremadura",
]);

/**
 * @typedef {{ x1: number; y1: number; x2: number; y2: number; score?: number }} DetectionBox
 */

/**
 * @param {number} gndvi media recortada global en el bbox
 * @param {number} cire
 * @param {number} sipi
 * @param {number} vari
 * @param {number} [gndviUpperMean] media del percentil alto de GNDVI (misma banda); si se omite, se usa gndvi
 * @param {number} [redCoverage] fracción [0..1] de píxeles rojos (VARI <= umbral rojo)
 * @returns {{ key: (typeof MATURITY_CLASSES)[number]; score: number }}
 */
export function classifyMaturityFromIndices(
  gndvi,
  cire,
  sipi,
  vari,
  gndviUpperMean,
  redCoverage
) {
  const t = maturityThresholds;
  const gndviU =
    gndviUpperMean != null && Number.isFinite(gndviUpperMean) ? gndviUpperMean : gndvi;
  const redCov = Number.isFinite(redCoverage) ? Math.max(0, Math.min(1, redCoverage)) : 0;
  const clamp01 = (v) => Math.max(0, Math.min(1, v));

  // Regla prioritaria solicitada: si VARI cae en rango verde, clasificar como inmadura.
  // Esto evita que otras señales empujen a "madura" una fruta claramente verde.
  if (vari >= t.variInmaduraMin) {
    return { key: "inmadura", score: 0 };
  }

  // Sombra en bbox: alta brecha => iluminacion no uniforme, reducimos peso de gndvi global.
  const shadowMix = clamp01(
    (Math.max(0, gndviU - gndvi) - 0.03) / 0.08
  ); // 0=sin sombra marcada, 1=sombra fuerte
  const gndviEff = (1 - shadowMix) * gndvi + shadowMix * gndviU;

  const redScore = clamp01((-vari - 0.045) / 0.09);
  const pigmentScore = clamp01((sipi - 0.99) / 0.2);
  const gndviLowScore = clamp01((0.43 - gndviEff) / 0.16);
  const cireLowScore = clamp01((0.95 - cire) / 0.7);
  const overripeScore =
    0.4 * redScore +
    0.32 * pigmentScore +
    0.16 * gndviLowScore +
    0.12 * cireLowScore;

  // Inmadura: clorofila alta + pigmento/rojo bajos.
  const greenStrong =
    gndviEff > t.greenStrongGndviMin &&
    cire > t.greenStrongCireMin;
  const lowPigment = sipi < t.lowPigmentInmaduraMax;
  const lowRed = vari > t.lowRedInmaduraMin;
  if (
    (greenStrong && lowPigment && lowRed) ||
    (gndviEff > t.veryGreenGndviMin &&
      cire > t.veryGreenCireMin &&
      vari > t.veryGreenVariMin)
  ) {
    return { key: "inmadura", score: overripeScore };
  }

  const voteVari =
    Number.isFinite(vari) && vari <= t.variVoteOverripeMax ? 1 : 0;
  const voteGndvi =
    Number.isFinite(gndviEff) && gndviEff <= t.gndviVoteOverripeMax ? 1 : 0;
  const voteCire =
    Number.isFinite(cire) && cire <= t.cireVoteOverripeMax ? 1 : 0;
  const voteSipi =
    Number.isFinite(sipi) && sipi >= t.sipiVoteOverripeMin ? 1 : 0;
  const votes = voteVari + voteGndvi + voteCire + voteSipi;

  // --- Filtro 1: mayoría “roja” en VARI (píxeles del bbox). Si no, inmadura.
  if (redCov < t.redCoverageForMaduraMin) {
    return { key: "inmadura", score: overripeScore };
  }

  // Mayoría roja → punto de partida madura; el resto de índices solo refina.
  /** @type {(typeof MATURITY_CLASSES)[number]} */
  let key = "madura";

  if (votes >= t.votesMinSobremadura) {
    key = "sobremadura";
  } else if (sipi < t.sipiMinForMadura) {
    key = "inmadura";
  } else if (
    votes <= t.votesMaxDowngradeToInmadura &&
    gndviEff > t.gndviHighStillGreenMin
  ) {
    key = "inmadura";
  }

  return { key, score: overripeScore };
}

/**
 * Medias espectrales dentro de cada bbox (GNDVI, CIre, SIPI, VARI) y clase de madurez.
 * Requiere las 5 bandas (R,G,B,RE,NIR) alineadas en resolución a la imagen de detección.
 *
 * @param {{ r: string; g: string; b: string; re: string; nir: string }} bandUrls
 * @param {DetectionBox[]} boxes
 * @returns {Promise<Array<DetectionBox & { maturity: string; score: number; indices: { gndvi: number; cire: number; sipi: number; vari: number } }>>}
 */
export async function analyzeStrawberryMaturityInBoxes(bandUrls, boxes) {
  const { w, h, R, G, B, RE, NIR } = await computeFiveBandAlignedReflectance(
    bandUrls
  );

  const out = [];

  for (const box of boxes) {
    const x1 = Math.max(0, Math.floor(box.x1));
    const y1 = Math.max(0, Math.floor(box.y1));
    const x2 = Math.min(w, Math.ceil(box.x2));
    const y2 = Math.min(h, Math.ceil(box.y2));

    // 1) Perfil de sombra desde RGB: luminancia + croma por píxel en el bbox.
    const lumPix = [];
    const chromaPix = [];
    for (let y = y1; y < y2; y++) {
      const row = y * w;
      for (let x = x1; x < x2; x++) {
        const i = row + x;
        const r = R[i];
        const gch = G[i];
        const bch = B[i];
        const maxCh = Math.max(r, gch, bch);
        const minCh = Math.min(r, gch, bch);
        const lum = 0.299 * r + 0.587 * gch + 0.114 * bch;
        lumPix.push(lum);
        chromaPix.push(maxCh - minCh);
      }
    }
    const lumP20 = percentile(lumPix, 0.2);
    const lumP50 = percentile(lumPix, 0.5);
    const chromaP35 = percentile(chromaPix, 0.35);
    const shadowLumThr = Math.min(lumP20 + 0.02, lumP50 * 0.78);
    const shadowChromaThr = chromaP35 * 0.85;

    const gndviPix = [];
    const cirePix = [];
    const sipiPix = [];
    const variPix = [];
    const gndviAll = [];
    const cireAll = [];
    const sipiAll = [];
    const variAll = [];
    let totalPix = 0;
    let shadowPix = 0;
    let redPix = 0;
    let nonShadowPix = 0;

    for (let y = y1; y < y2; y++) {
      const row = y * w;
      for (let x = x1; x < x2; x++) {
        totalPix++;
        const i = row + x;
        const r = R[i];
        const gch = G[i];
        const bch = B[i];
        const re = RE[i];
        const nir = NIR[i];
        const maxCh = Math.max(r, gch, bch);
        const minCh = Math.min(r, gch, bch);
        const lum = 0.299 * r + 0.587 * gch + 0.114 * bch;
        const chroma = maxCh - minCh;
        const isShadow = lum < shadowLumThr && chroma < shadowChromaThr;
        if (isShadow) shadowPix++;
        else nonShadowPix++;

        const denG = nir + gch + EPS;
        const gndviV = (nir - gch) / denG;
        gndviAll.push(gndviV);
        if (!isShadow) gndviPix.push(gndviV);

        if (re > EPS) {
          const cireV = nir / re - 1;
          cireAll.push(cireV);
          if (!isShadow) cirePix.push(cireV);
        }

        const denS = nir - r;
        if (Math.abs(denS) >= minDenomMagnitude(nir + r)) {
          const sipiV = (nir - bch) / denS;
          sipiAll.push(sipiV);
          if (!isShadow) sipiPix.push(sipiV);
        }

        const denV = gch + r - bch;
        if (Math.abs(denV) >= minDenomMagnitude(gch + r + bch)) {
          const variV = (gch - r) / denV;
          variAll.push(variV);
          if (!isShadow) {
            variPix.push(variV);
            if (variV <= maturityThresholds.variRedPixelMax) {
              redPix++;
            }
          }
        }
      }
    }

    // Si la mascara elimina demasiados píxeles, usar todos para no inestabilizar.
    const validFrac = totalPix > 0 ? gndviPix.length / totalPix : 0;
    const useAll = validFrac < 0.35;
    const gndviSrc = useAll ? gndviAll : gndviPix;
    const cireSrc = useAll ? cireAll : cirePix;
    const sipiSrc = useAll ? sipiAll : sipiPix;
    const variSrc = useAll ? variAll : variPix;

    const gndvi = trimmedMean(gndviSrc);
    const gndviUpperMean = upperFractionMean(gndviSrc, 0.28);
    const cire = cireSrc.length ? trimmedMean(cireSrc) : 0;
    const sipi = sipiSrc.length ? trimmedMean(sipiSrc) : 1;
    const vari = variSrc.length ? trimmedMean(variSrc) : 0;
    const redCoverage = nonShadowPix > 0 ? redPix / nonShadowPix : 0;

    const { key, score } = classifyMaturityFromIndices(
      gndvi,
      cire,
      sipi,
      vari,
      gndviUpperMean,
      redCoverage
    );
    out.push({
      ...box,
      maturity: key,
      score,
      indices: {
        gndvi,
        cire,
        sipi,
        vari,
        gndviUpperMean,
        redCoverage,
        shadowFraction: totalPix > 0 ? shadowPix / totalPix : 0,
        shadowMasked: !useAll,
      },
    });
  }

  return out;
}
