import { supabase } from "@/lib/supabase";

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

  const base = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
  if (!base || !publicUrl.startsWith(base)) return null;

  const re = /\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/;
  const m = publicUrl.match(re);
  if (!m) return null;

  const bucket = m[1];
  const path = decodeURIComponent(m[2]);

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 3600);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
