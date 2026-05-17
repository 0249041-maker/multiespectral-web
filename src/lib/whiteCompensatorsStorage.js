import { WHITE_COMPENSATORS_BUCKET } from "@/lib/cameraDashboardConstants";
import { supabase } from "@/lib/supabase";
import { formatSupabaseError } from "@/lib/spectralStorage";

const IMAGE_EXT = /\.(png|jpe?g|webp|bmp)$/i;

/**
 * @typedef {{ name: string, path: string, publicUrl: string, updatedAt?: string }} WhiteCompensatorFile
 * @typedef {{ id: string, folder: string, files: WhiteCompensatorFile[], createdAt?: string }} WhiteCompensatorSession
 */

function isFolderEntry(entry) {
  return entry != null && (entry.id == null || entry.id === undefined);
}

function publicUrlForPath(path) {
  if (!supabase) return "";
  const { data } = supabase.storage.from(WHITE_COMPENSATORS_BUCKET).getPublicUrl(path);
  return data?.publicUrl ?? "";
}

/**
 * Lista carpetas de compensadores en la raíz del bucket (cada carpeta = un compensador).
 * @returns {Promise<WhiteCompensatorSession[]>}
 */
export async function listWhiteCompensatorSessions() {
  if (!supabase) {
    throw new Error("Supabase no está configurado");
  }

  const { data: rootItems, error: listErr } = await supabase.storage
    .from(WHITE_COMPENSATORS_BUCKET)
    .list("", {
      limit: 200,
      sortBy: { column: "created_at", order: "desc" },
    });

  if (listErr) {
    throw new Error(formatSupabaseError(listErr));
  }

  const folders = (rootItems ?? []).filter(isFolderEntry);
  const sessions = [];

  for (const folder of folders) {
    const folderName = folder.name;
    if (!folderName || folderName.startsWith(".")) continue;

    const { data: files, error: filesErr } = await supabase.storage
      .from(WHITE_COMPENSATORS_BUCKET)
      .list(folderName, {
        limit: 50,
        sortBy: { column: "name", order: "asc" },
      });

    if (filesErr) {
      console.warn(`[white_compensators] list ${folderName}:`, filesErr.message);
      continue;
    }

    const imageFiles = (files ?? [])
      .filter((f) => f.name && !isFolderEntry(f) && IMAGE_EXT.test(f.name))
      .map((f) => {
        const path = `${folderName}/${f.name}`;
        return {
          name: f.name,
          path,
          publicUrl: publicUrlForPath(path),
          updatedAt: f.updated_at ?? f.created_at,
        };
      });

    if (imageFiles.length === 0) continue;

    sessions.push({
      id: folderName,
      folder: folderName,
      files: imageFiles,
      createdAt: folder.created_at ?? folder.updated_at,
    });
  }

  sessions.sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tb - ta;
  });

  return sessions;
}

export { WHITE_COMPENSATORS_BUCKET };
