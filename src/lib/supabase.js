import { createClient } from "@supabase/supabase-js";

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const rawKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KE;

const supabaseUrl = typeof rawUrl === "string" ? rawUrl.trim() : "";
const supabaseAnonKey = typeof rawKey === "string" ? rawKey.trim() : "";

/** Si createClient falla, el mensaje (solo para diagnóstico en UI). */
export let supabaseClientError = null;

let _client = null;
if (supabaseUrl && supabaseAnonKey) {
  try {
    _client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  } catch (e) {
    supabaseClientError =
      e instanceof Error ? e.message : "No se pudo crear el cliente Supabase";
  }
}

export const supabase = _client;

/**
 * Resumen para mostrar en la UI (sin exponer secretos).
 */
export function getSupabaseEnvDebug() {
  const hasUrl = Boolean(supabaseUrl);
  const hasKey = Boolean(supabaseAnonKey);
  const urlOk = !hasUrl || supabaseUrl.startsWith("https://");

  return {
    hasUrl,
    hasKey,
    urlOk,
    configured: Boolean(supabase),
    clientError: supabaseClientError,
    /** true si faltan variables en el build (p. ej. Vercel sin redeploy) */
    likelyMissingBuildEnv: !hasUrl || !hasKey,
  };
}
