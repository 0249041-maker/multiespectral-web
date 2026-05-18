import { WHITE_CALIBRATION_BANDS_NM } from "@/lib/cameraDashboardConstants";

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
      reject(new Error("No se pudo decodificar la imagen BMP."));
    };
    img.src = u;
  });
}

/**
 * Intensidad 0–1 de un píxel BMP monocromático (un canal por banda; R=G=B en disco).
 * @param {Uint8ClampedArray} data buffer RGBA de canvas
 * @param {number} pixelIndex índice de píxel (0 … w*h-1)
 */
function monochromeIntensityFromPixel(data, pixelIndex) {
  return data[pixelIndex * 4] / 255;
}

/**
 * Nivel medio 0–255 de una imagen (referencia blanca por banda).
 * @param {string} url
 */
export async function computeMeanLevelFromImageUrl(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`No se pudo descargar ${url} (${res.status})`);
  }
  const blob = await res.blob();
  const img = await loadImageFromBlob(blob);
  const w = img.width;
  const h = img.height;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D no disponible.");
  ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  let sum = 0;
  const n = w * h;
  for (let i = 0; i < n; i++) {
    sum += monochromeIntensityFromPixel(data, i);
  }
  return Math.round(Math.max(0, Math.min(255, (sum / n) * 255)));
}

/**
 * @param {Record<string, { url?: string, publicUrl?: string }>} filesMap
 * @param {number} nm
 */
function resolveBandFileUrl(filesMap, nm) {
  const key = String(nm);
  let entry = filesMap[key] ?? filesMap[`${nm}.bmp`];
  if (!entry) {
    const found = Object.entries(filesMap).find(([k]) => k.startsWith(key));
    entry = found?.[1];
  }
  return entry?.url ?? entry?.publicUrl ?? null;
}

/**
 * @param {Record<string, { url?: string }>} filesMap claves "450", "550", … o nombres de archivo
 */
export async function computeCompensatorsFromFilesMap(filesMap) {
  const entries = await Promise.all(
    WHITE_CALIBRATION_BANDS_NM.map(async (nm) => {
      const key = String(nm);
      const url = resolveBandFileUrl(filesMap, nm);
      if (!url) {
        throw new Error(`Falta la banda ${nm} nm en el cubo blanco.`);
      }
      const level = await computeMeanLevelFromImageUrl(url);
      return [key, level];
    })
  );

  return Object.fromEntries(entries);
}

/**
 * Procesa el result de command_done capture_white_reference.
 * @param {Record<string, unknown>} result
 */
export async function computeCompensatorsFromCaptureResult(result) {
  const files = /** @type {Record<string, { url?: string }>} */ (result.files ?? {});
  const compensators = await computeCompensatorsFromFilesMap(files);

  return {
    cube_id: String(result.cube_id ?? ""),
    storage_path: String(result.storage_path ?? ""),
    exposure_ms:
      typeof result.exposure_ms === "number" ? result.exposure_ms : undefined,
    bucket: String(result.bucket ?? "white_compensators"),
    compensators,
    files,
  };
}

/**
 * @param {{ id: string, storagePath: string, bandFiles: Array<{ nm: number, url: string }> }} session
 */
export async function computeCompensatorsFromSession(session) {
  const filesMap = {};
  for (const b of session.bandFiles) {
    filesMap[String(b.nm)] = { url: b.url };
  }
  const compensators = await computeCompensatorsFromFilesMap(filesMap);
  return {
    cube_id: session.id.split("/").pop() ?? session.id,
    storage_path: session.storagePath,
    compensators,
  };
}
