import { supabase } from "@/lib/supabase";
import { formatSupabaseError } from "@/lib/spectralStorage";

/** Misma fila que defines en Supabase para la cámara multiespectral. */
export const CAMERA_STATUS_ID = "camera_001";

/**
 * @returns {Promise<{ tunnelUrl: string; online: boolean }>}
 */
export async function fetchCameraStatus() {
  if (!supabase) {
    return { tunnelUrl: "", online: false };
  }

  const { data, error } = await supabase
    .from("camera_status")
    .select("tunnel_url, online")
    .eq("id", CAMERA_STATUS_ID)
    .maybeSingle();

  if (error) throw new Error(formatSupabaseError(error));

  const raw = data?.tunnel_url;
  const tunnelUrl = typeof raw === "string" ? raw.trim() : "";
  return {
    tunnelUrl,
    online: Boolean(data?.online),
  };
}

/**
 * Publica el wss:// del túnel Cloudflare para la cámara multiespectral.
 * @param {string} url
 */
export async function upsertCameraTunnelUrl(url) {
  if (!supabase) {
    throw new Error("Supabase no está configurado");
  }

  const trimmed = typeof url === "string" ? url.trim() : "";
  const now = new Date().toISOString();

  const { error } = await supabase.from("camera_status").upsert(
    {
      id: CAMERA_STATUS_ID,
      tunnel_url: trimmed || null,
      online: trimmed.length > 0,
      updated_at: now,
    },
    { onConflict: "id" }
  );

  if (error) throw new Error(formatSupabaseError(error));
}

/** @param {string} url */
export function isValidWsUrl(url) {
  if (typeof url !== "string") return false;
  const t = url.trim();
  return t.startsWith("ws://") || t.startsWith("wss://");
}
