import { supabase } from "@/lib/supabase";

/**
 * Extrae bucket y path de una URL pública de Storage (mismo proyecto que el cliente).
 * No exige coincidencia con VITE_SUPABASE_URL: si la URL guardada en la BD difiere
 * solo en barra final o formato, igual podemos firmar con el cliente actual.
 */
export function parsePublicStorageUrl(publicUrl) {
  if (!publicUrl || typeof publicUrl !== "string") return null;
  const clean = publicUrl.split("?")[0].trim();
  const re = /\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/;
  const m = clean.match(re);
  if (!m) return null;
  const bucket = m[1];
  let path = m[2];
  try {
    path = decodeURIComponent(path);
  } catch {
    /* mantener */
  }
  return { bucket, path };
}

/**
 * Convierte una URL pública de Storage de Supabase en URL firmada (1 h).
 * Útil cuando el bucket no es del todo público o falla la lectura anónima.
 * @param {string} publicUrl
 * @returns {Promise<string | null>}
 */
export async function signedUrlFromPublicStorageUrl(publicUrl) {
  if (!supabase || !publicUrl || typeof publicUrl !== "string") return null;
  if (publicUrl.startsWith("blob:") || publicUrl.startsWith("data:")) {
    return null;
  }

  const parsed = parsePublicStorageUrl(publicUrl);
  if (!parsed) return null;

  const { data, error } = await supabase.storage
    .from(parsed.bucket)
    .createSignedUrl(parsed.path, 3600);

  if (error || !data?.signedUrl) {
    if (import.meta.env.DEV) {
      console.warn(
        "[storage] createSignedUrl:",
        error?.message,
        parsed.bucket,
        parsed.path
      );
    }
    return null;
  }
  return data.signedUrl;
}
