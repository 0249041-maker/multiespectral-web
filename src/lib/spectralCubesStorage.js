import { WHITE_CALIBRATION_BANDS_NM } from "@/lib/cameraDashboardConstants";
import { formatSupabaseError, SPECTRAL_BUCKET } from "@/lib/spectralStorage";
import { supabase } from "@/lib/supabase";

/** Mapeo nm (BMP del instrumento) → claves del visor avanzado. */
export const SPECTRAL_CUBE_NM_TO_BAND_KEY = {
  450: "b",
  550: "g",
  656: "r",
  725: "re",
  850: "nir",
};

const BMP_NM = /^(\d{3})\.bmp$/i;
const CUBE_FOLDER = /^cube_(\d{8})_(\d{6})$/;

function isFolderEntry(entry) {
  return entry != null && (entry.id == null || entry.id === undefined);
}

function publicUrlForPath(path) {
  if (!supabase) return "";
  const { data } = supabase.storage.from(SPECTRAL_BUCKET).getPublicUrl(path);
  return data?.publicUrl ?? "";
}

/**
 * @param {string} cubeFolderName ej. cube_20260517_173659
 */
function parseCubeTimestampLabel(cubeFolderName) {
  const m = cubeFolderName.match(CUBE_FOLDER);
  if (!m) return cubeFolderName;
  const [, ymd, hms] = m;
  const iso = `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}T${hms.slice(0, 2)}:${hms.slice(2, 4)}:${hms.slice(4, 6)}`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return cubeFolderName;
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/**
 * @typedef {{
 *   id: string,
 *   cameraId: string,
 *   cubeId: string,
 *   storagePath: string,
 *   label: string,
 *   timestampLabel: string,
 *   metadataUrl?: string,
 *   bands: { r: string | null, g: string | null, b: string | null, re: string | null, nir: string | null, ndvi: string | null },
 *   stats: { mean: number, min: number, max: number },
 *   source: "storage",
 * }} StorageSpectralCube
 */

/**
 * Lista cubos en Storage: capture_image/{camera_id}/cube_YYYYMMDD_HHMMSS/{450,550,...}.bmp
 * @returns {Promise<StorageSpectralCube[]>}
 */
export async function listSpectralCubesFromStorage() {
  if (!supabase) {
    throw new Error("Supabase no está configurado");
  }

  const { data: cameras, error: camErr } = await supabase.storage
    .from(SPECTRAL_BUCKET)
    .list("", { limit: 100, sortBy: { column: "name", order: "asc" } });

  if (camErr) {
    throw new Error(formatSupabaseError(camErr));
  }

  /** @type {StorageSpectralCube[]} */
  const cubes = [];

  for (const cam of cameras ?? []) {
    if (!isFolderEntry(cam) || !cam.name || cam.name.startsWith(".")) continue;
    const cameraId = cam.name;

    const { data: cubeFolders, error: cubeErr } = await supabase.storage
      .from(SPECTRAL_BUCKET)
      .list(cameraId, {
        limit: 200,
        sortBy: { column: "created_at", order: "desc" },
      });

    if (cubeErr) {
      console.warn(`[${SPECTRAL_BUCKET}] list ${cameraId}:`, cubeErr.message);
      continue;
    }

    for (const folder of cubeFolders ?? []) {
      if (!isFolderEntry(folder) || !folder.name?.startsWith("cube_")) continue;
      const cubeId = folder.name;
      const storagePath = `${cameraId}/${cubeId}/`;

      const { data: files, error: filesErr } = await supabase.storage
        .from(SPECTRAL_BUCKET)
        .list(`${cameraId}/${cubeId}`, {
          limit: 20,
          sortBy: { column: "name", order: "asc" },
        });

      if (filesErr) continue;

      /** @type {Record<string, string | null>} */
      const bands = { r: null, g: null, b: null, re: null, nir: null, ndvi: null };
      let metadataUrl;
      let bandCount = 0;

      for (const f of files ?? []) {
        if (!f.name || isFolderEntry(f)) continue;
        const path = `${cameraId}/${cubeId}/${f.name}`;
        if (f.name === "metadata.json") {
          metadataUrl = publicUrlForPath(path);
          continue;
        }
        const nmMatch = f.name.match(BMP_NM);
        if (!nmMatch) continue;
        const nm = Number.parseInt(nmMatch[1], 10);
        const key = SPECTRAL_CUBE_NM_TO_BAND_KEY[nm];
        if (!key || !WHITE_CALIBRATION_BANDS_NM.includes(nm)) continue;
        bands[key] = publicUrlForPath(path);
        bandCount += 1;
      }

      if (bandCount === 0) continue;

      cubes.push({
        id: `${cameraId}/${cubeId}`,
        cameraId,
        cubeId,
        storagePath,
        label: cubeId,
        timestampLabel: parseCubeTimestampLabel(cubeId),
        metadataUrl,
        bands,
        stats: { mean: 0.6, min: -0.95, max: 0.99 },
        source: "storage",
      });
    }
  }

  cubes.sort((a, b) => {
    const ta = a.cubeId.match(CUBE_FOLDER);
    const tb = b.cubeId.match(CUBE_FOLDER);
    if (!ta || !tb) return b.cubeId.localeCompare(a.cubeId);
    const ka = `${ta[1]}${ta[2]}`;
    const kb = `${tb[1]}${tb[2]}`;
    return kb.localeCompare(ka);
  });

  return cubes;
}

/**
 * Borra un cubo en la estructura camera_id/cube_* (solo Storage).
 * @param {string} storageCubeId ej. camera_001/cube_20260517_173659
 */
export async function deleteSpectralCubeFromStorage(storageCubeId) {
  if (!supabase) {
    throw new Error("Supabase no está configurado");
  }
  const parts = storageCubeId.split("/").filter(Boolean);
  if (parts.length < 2) {
    throw new Error("Id de cubo en Storage no válido");
  }
  const cameraId = parts[0];
  const cubeId = parts[1];
  const prefix = `${cameraId}/${cubeId}`;

  const { data: listed, error: listErr } = await supabase.storage
    .from(SPECTRAL_BUCKET)
    .list(prefix, { limit: 50 });

  if (listErr) {
    throw new Error(formatSupabaseError(listErr));
  }

  const paths = (listed ?? [])
    .filter((f) => f.name && !isFolderEntry(f))
    .map((f) => `${prefix}/${f.name}`);

  if (paths.length === 0) {
    throw new Error("No hay archivos que borrar en este cubo");
  }

  const { error: rmErr } = await supabase.storage.from(SPECTRAL_BUCKET).remove(paths);
  if (rmErr) {
    throw new Error(formatSupabaseError(rmErr));
  }
}

/** true si el id es camera_xxx/cube_YYYYMMDD_HHMMSS */
export function isStorageSpectralCubeId(id) {
  return typeof id === "string" && /^[^/]+\/cube_\d{8}_\d{6}$/.test(id);
}
