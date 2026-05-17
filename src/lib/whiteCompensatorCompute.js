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

function luminanceFromRgba(r, g, b) {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
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
    const o = i * 4;
    sum += luminanceFromRgba(data[o], data[o + 1], data[o + 2]);
  }
  return Math.round(Math.max(0, Math.min(255, (sum / n) * 255)));
}

/**
 * @param {Record<string, { url?: string }>} filesMap claves "450", "550", … o nombres de archivo
 */
export async function computeCompensatorsFromFilesMap(filesMap) {
  /** @type {Record<string, number>} */
  const compensators = {};

  for (const nm of WHITE_CALIBRATION_BANDS_NM) {
    const key = String(nm);
    let entry = filesMap[key] ?? filesMap[`${nm}.bmp`];
    if (!entry) {
      const found = Object.entries(filesMap).find(([k]) => k.startsWith(String(nm)));
      entry = found?.[1];
    }
    const url = entry?.url ?? entry?.publicUrl;
    if (!url) {
      throw new Error(`Falta la banda ${nm} nm en el cubo blanco.`);
    }
    compensators[key] = await computeMeanLevelFromImageUrl(url);
  }

  return compensators;
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
