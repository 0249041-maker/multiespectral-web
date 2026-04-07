import { supabase } from "@/lib/supabase";

/**
 * Si la BD guardó una ruta relativa (empieza por /storage/...), antepone la URL del proyecto.
 */
export function normalizeSupabaseStorageImageUrl(src) {
  if (!src || typeof src !== "string") return src;
  const t = src.trim();
  if (t.startsWith("blob:") || t.startsWith("data:")) return t;
  if (t.startsWith("http://") || t.startsWith("https://")) return t;
  const base = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
  if (!base) return t;
  if (t.startsWith("/")) return `${base}${t}`;
  return t;
}

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
 * Descarga el objeto con la API (anon + RLS). Útil cuando el <img> no puede cargar
 * la URL pública/firmada (políticas, referrer, otro dispositivo).
 * @returns {Promise<string | null>} object URL (blob:) o null
 */
export async function publicStorageUrlToBlobUrl(publicUrl) {
  if (!supabase) return null;
  const normalized = normalizeSupabaseStorageImageUrl(publicUrl);
  const parsed = parsePublicStorageUrl(normalized);
  if (!parsed) return null;
  const { data, error } = await supabase.storage
    .from(parsed.bucket)
    .download(parsed.path);
  if (error || !data) {
    if (import.meta.env.DEV) {
      console.warn("[storage] download", error?.message, parsed);
    }
    return null;
  }
  return URL.createObjectURL(data);
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

  const normalized = normalizeSupabaseStorageImageUrl(publicUrl);
  const parsed = parsePublicStorageUrl(normalized);
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
