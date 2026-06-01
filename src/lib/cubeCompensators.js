import { SPECTRAL_CUBE_NM_TO_BAND_KEY } from "@/lib/spectralCubesStorage";

/**
 * Compensadores por banda. Cada valor es la intensidad media (0..255) del cubo
 * blanco para esa banda, calculada en `whiteCompensatorCompute.js`.
 *
 * Para compensar la reflectancia se hace, por píxel:
 *   reflectancia = banda_raw_0_1 / (compensador_0_255 / 255)
 *
 * @typedef {{ r?: number, g?: number, b?: number, re?: number, nir?: number }} CompensatorsByBand
 */

const NM_TO_KEY = SPECTRAL_CUBE_NM_TO_BAND_KEY;
const KEY_TO_NM = Object.fromEntries(
  Object.entries(NM_TO_KEY).map(([nm, k]) => [k, Number.parseInt(nm, 10)])
);

const KNOWN_KEYS = ["r", "g", "b", "re", "nir"];

/** Cache por URL de metadata.json → CompensatorsByBand o null. */
const cache = new Map();
/** Cache por URL de metadata.json → JSON completo (o null si no se pudo cargar). */
const metadataCache = new Map();

/**
 * Convierte un objeto crudo (keys de nm o de banda) a `{ r, g, b, re, nir }` 0..255.
 * @param {Record<string, unknown> | null | undefined} raw
 * @returns {CompensatorsByBand | null}
 */
export function normalizeCompensators(raw) {
  if (!raw || typeof raw !== "object") return null;
  /** @type {CompensatorsByBand} */
  const out = {};
  let count = 0;

  for (const [k, v] of Object.entries(raw)) {
    const num = Number(v);
    if (!Number.isFinite(num) || num <= 0) continue;
    const keyLower = String(k).toLowerCase();
    if (KNOWN_KEYS.includes(keyLower)) {
      out[keyLower] = num;
      count += 1;
      continue;
    }
    const nm = Number.parseInt(k, 10);
    if (Number.isFinite(nm) && NM_TO_KEY[nm]) {
      out[NM_TO_KEY[nm]] = num;
      count += 1;
    }
  }

  return count > 0 ? out : null;
}

/**
 * Extrae compensadores de un objeto metadata arbitrario.
 * Acepta `{ compensators }`, `{ white_reference: { compensators } }`, etc.
 * @param {Record<string, unknown> | null | undefined} metadata
 */
export function extractCompensatorsFromMetadata(metadata) {
  if (!metadata || typeof metadata !== "object") return null;
  const candidates = [
    metadata.compensators,
    metadata.white_reference?.compensators,
    metadata.whiteReference?.compensators,
    metadata.calibration?.compensators,
  ];
  for (const c of candidates) {
    const norm = normalizeCompensators(c);
    if (norm) return norm;
  }
  return null;
}

/**
 * Descarga metadata.json y devuelve compensadores por banda (con cache).
 * @param {string | null | undefined} metadataUrl
 * @returns {Promise<CompensatorsByBand | null>}
 */
export async function fetchCubeCompensators(metadataUrl) {
  if (!metadataUrl) return null;
  if (cache.has(metadataUrl)) return cache.get(metadataUrl);

  let comp = null;
  try {
    const res = await fetch(metadataUrl, { credentials: "omit" });
    if (res.ok) {
      const json = await res.json();
      comp = extractCompensatorsFromMetadata(json);
    }
  } catch {
    // ignore network/parse errors → sin compensación
  }
  cache.set(metadataUrl, comp);
  return comp;
}

/** Borra la cache (útil tras reprocesar un cube). */
export function clearCubeCompensatorsCache() {
  cache.clear();
  metadataCache.clear();
}

/**
 * Descarga y cachea el contenido completo del `metadata.json` (parseado).
 * Devuelve `null` si no hay URL o si la descarga/parsing falla.
 * @param {string | null | undefined} metadataUrl
 * @returns {Promise<Record<string, unknown> | null>}
 */
export async function fetchCubeMetadata(metadataUrl) {
  if (!metadataUrl) return null;
  if (metadataCache.has(metadataUrl)) return metadataCache.get(metadataUrl);

  let json = null;
  try {
    const res = await fetch(metadataUrl, { credentials: "omit" });
    if (res.ok) {
      json = await res.json();
    }
  } catch {
    json = null;
  }
  metadataCache.set(metadataUrl, json);
  return json;
}

/**
 * Factor por banda a aplicar sobre una intensidad 0..1 para obtener reflectancia.
 * `reflectancia = intensidad * factor`. Si el compensador es nulo o inválido, devuelve 1.
 * @param {number | undefined | null} comp valor 0..255
 */
export function compensationFactor(comp) {
  if (!Number.isFinite(comp) || comp == null) return 1;
  const norm = Number(comp) / 255;
  if (norm <= 1e-3) return 1;
  return 1 / norm;
}

/**
 * Construye un mapa de factores por banda; las bandas sin compensador quedan en 1.
 * @param {CompensatorsByBand | null | undefined} compensators
 * @returns {{ r: number, g: number, b: number, re: number, nir: number }}
 */
export function buildCompensationFactors(compensators) {
  return {
    r: compensationFactor(compensators?.r),
    g: compensationFactor(compensators?.g),
    b: compensationFactor(compensators?.b),
    re: compensationFactor(compensators?.re),
    nir: compensationFactor(compensators?.nir),
  };
}

/**
 * Devuelve true si al menos un factor difiere de 1 (es decir, hay alguna compensación útil).
 * @param {{ r: number, g: number, b: number, re: number, nir: number } | null | undefined} factors
 */
export function hasAnyCompensation(factors) {
  if (!factors) return false;
  for (const k of KNOWN_KEYS) {
    if (factors[k] && Math.abs(factors[k] - 1) > 1e-6) return true;
  }
  return false;
}

export { KEY_TO_NM, NM_TO_KEY };
