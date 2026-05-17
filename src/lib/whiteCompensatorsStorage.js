import {
  WHITE_CALIBRATION_BANDS_NM,
  WHITE_COMPENSATORS_BUCKET,
} from "@/lib/cameraDashboardConstants";
import { supabase } from "@/lib/supabase";
import { formatSupabaseError } from "@/lib/spectralStorage";

const BMP_EXT = /\.bmp$/i;

/**
 * @typedef {{ nm: number, name: string, path: string, url: string }} WhiteBandFile
 * @typedef {{
 *   id: string,
 *   cameraId: string,
 *   cubeId: string,
 *   storagePath: string,
 *   bandFiles: WhiteBandFile[],
 *   metadataUrl?: string,
 *   createdAt?: string,
 * }} WhiteCompensatorSession
 */

function isFolderEntry(entry) {
  return entry != null && (entry.id == null || entry.id === undefined);
}

function publicUrlForPath(path) {
  if (!supabase) return "";
  const { data } = supabase.storage.from(WHITE_COMPENSATORS_BUCKET).getPublicUrl(path);
  return data?.publicUrl ?? "";
}

function parseBandNm(fileName) {
  const m = fileName.match(/^(\d{3})\.bmp$/i);
  if (!m) return null;
  const nm = Number.parseInt(m[1], 10);
  return WHITE_CALIBRATION_BANDS_NM.includes(nm) ? nm : null;
}

/**
 * Lista cubos blancos: white_compensators/{camera_id}/{white_YYYYMMDD_HHMMSS}/
 * @returns {Promise<WhiteCompensatorSession[]>}
 */
export async function listWhiteCompensatorSessions() {
  if (!supabase) {
    throw new Error("Supabase no está configurado");
  }

  const { data: cameras, error: camErr } = await supabase.storage
    .from(WHITE_COMPENSATORS_BUCKET)
    .list("", {
      limit: 100,
      sortBy: { column: "name", order: "asc" },
    });

  if (camErr) {
    throw new Error(formatSupabaseError(camErr));
  }

  const sessions = [];

  for (const cam of cameras ?? []) {
    if (!isFolderEntry(cam) || !cam.name || cam.name.startsWith(".")) continue;
    const cameraId = cam.name;

    const { data: cubes, error: cubeErr } = await supabase.storage
      .from(WHITE_COMPENSATORS_BUCKET)
      .list(cameraId, {
        limit: 200,
        sortBy: { column: "created_at", order: "desc" },
      });

    if (cubeErr) {
      console.warn(`[white_compensators] list ${cameraId}:`, cubeErr.message);
      continue;
    }

    for (const cube of cubes ?? []) {
      if (!isFolderEntry(cube) || !cube.name?.startsWith("white_")) continue;
      const cubeId = cube.name;
      const storagePath = `${cameraId}/${cubeId}/`;

      const { data: files, error: filesErr } = await supabase.storage
        .from(WHITE_COMPENSATORS_BUCKET)
        .list(`${cameraId}/${cubeId}`, {
          limit: 20,
          sortBy: { column: "name", order: "asc" },
        });

      if (filesErr) continue;

      /** @type {WhiteBandFile[]} */
      const bandFiles = [];
      let metadataUrl;

      for (const f of files ?? []) {
        if (!f.name || isFolderEntry(f)) continue;
        const path = `${cameraId}/${cubeId}/${f.name}`;
        if (f.name === "metadata.json") {
          metadataUrl = publicUrlForPath(path);
          continue;
        }
        const nm = parseBandNm(f.name);
        if (nm == null) continue;
        bandFiles.push({
          nm,
          name: f.name,
          path,
          url: publicUrlForPath(path),
        });
      }

      if (bandFiles.length === 0) continue;

      bandFiles.sort((a, b) => a.nm - b.nm);

      sessions.push({
        id: `${cameraId}/${cubeId}`,
        cameraId,
        cubeId,
        storagePath,
        bandFiles,
        metadataUrl,
        createdAt: cube.created_at ?? cube.updated_at,
      });
    }
  }

  sessions.sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tb - ta;
  });

  return sessions;
}

/**
 * Borra todos los archivos de un cubo blanco en Storage.
 * @param {Pick<WhiteCompensatorSession, "cameraId" | "cubeId" | "bandFiles" | "storagePath">} session
 */
export async function deleteWhiteCompensatorSession(session) {
  if (!supabase) {
    throw new Error("Supabase no está configurado");
  }
  const { cameraId, cubeId } = session;
  if (!cameraId || !cubeId) {
    throw new Error("Sesión de calibración no válida");
  }

  const prefix = `${cameraId}/${cubeId}`;

  const { data: listed, error: listErr } = await supabase.storage
    .from(WHITE_COMPENSATORS_BUCKET)
    .list(prefix, { limit: 50 });

  if (listErr) {
    throw new Error(formatSupabaseError(listErr));
  }

  const paths = (listed ?? [])
    .filter((f) => f.name && !isFolderEntry(f))
    .map((f) => `${prefix}/${f.name}`);

  if (paths.length === 0 && session.bandFiles?.length) {
    for (const b of session.bandFiles) {
      if (b.path) paths.push(b.path);
    }
    paths.push(`${prefix}/metadata.json`);
  }

  if (paths.length === 0) {
    throw new Error("No hay archivos que borrar en este cubo");
  }

  const uniquePaths = [...new Set(paths)];

  const { error: rmErr } = await supabase.storage
    .from(WHITE_COMPENSATORS_BUCKET)
    .remove(uniquePaths);

  if (rmErr) {
    throw new Error(formatSupabaseError(rmErr));
  }
}

export { WHITE_COMPENSATORS_BUCKET };
