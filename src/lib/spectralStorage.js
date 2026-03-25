import { supabase } from "@/lib/supabase";

export const SPECTRAL_BUCKET =
  import.meta.env.VITE_SUPABASE_SPECTRAL_BUCKET || "spectral-captures";

/** @typedef {{ r: File; g: File; b: File; re: File; nir: File }} SpectralFiles */

const extOf = (file) => {
  const p = file.name.split(".").pop();
  return p && p.length <= 5 ? p.toLowerCase() : "png";
};

/**
 * Sube bandas a Storage e inserta captures + capture_images.
 * Acepta parcial: mínimo R y NIR. Si r+nir presentes, calcula NDVI y sube ndvi.png.
 * @param {{ r?: File; g?: File; b?: File; re?: File; nir?: File }} files
 * @param {Blob | null} ndviBlob
 * @returns {Promise<{ id: string; bands: Record<string, string | null> }>}
 */
export async function persistSpectralCube(files, ndviBlob = null) {
  if (!supabase) {
    throw new Error("Supabase no está configurado");
  }

  const { data: capRow, error: capErr } = await supabase
    .from("captures")
    .insert({ timestamp: new Date().toISOString() })
    .select("id")
    .single();

  if (capErr) throw capErr;
  const captureId = capRow.id;

  const bands = { r: null, g: null, b: null, re: null, nir: null, ndvi: null };

  const uploadOne = async (key, fileOrBlob) => {
    const isBlob = typeof Blob !== "undefined" && fileOrBlob instanceof Blob;
    const ext = isBlob ? "png" : extOf(/** @type {File} */ (fileOrBlob));
    const path = `${captureId}/${key}.${ext}`;
    const contentType = isBlob ? "image/png" : fileOrBlob.type || undefined;
    const { error: upErr } = await supabase.storage
      .from(SPECTRAL_BUCKET)
      .upload(path, fileOrBlob, { upsert: true, contentType });
    if (upErr) throw upErr;
    const { data: pub } = supabase.storage
      .from(SPECTRAL_BUCKET)
      .getPublicUrl(path);
    return pub.publicUrl;
  };

  for (const key of ["r", "g", "b", "re", "nir"]) {
    const f = files[key];
    if (f) bands[key] = await uploadOne(key, f);
  }

  if (ndviBlob) {
    bands.ndvi = await uploadOne("ndvi", ndviBlob);
  }

  const row = {
    capture_id: captureId,
    img_r: bands.r,
    img_g: bands.g,
    img_b: bands.b,
    img_re: bands.re,
    img_nir: bands.nir,
  };
  if (bands.ndvi) row.img_ndvi = bands.ndvi;

  let imgErr = (await supabase.from("capture_images").insert(row)).error;
  if (imgErr && bands.ndvi) {
    delete row.img_ndvi;
    imgErr = (await supabase.from("capture_images").insert(row)).error;
  }
  if (imgErr) throw imgErr;

  return { id: captureId, bands };
}

/**
 * Crea URLs locales para bandas proporcionadas y opcionalmente NDVI.
 * @param {{ r?: File; g?: File; b?: File; re?: File; nir?: File }} files
 * @param {Blob | null} ndviBlob
 */
export function localPartialBandUrls(files, ndviBlob = null) {
  const out = { r: null, g: null, b: null, re: null, nir: null, ndvi: null };
  for (const k of ["r", "g", "b", "re", "nir"]) {
    if (files[k]) out[k] = URL.createObjectURL(files[k]);
  }
  if (ndviBlob) out.ndvi = URL.createObjectURL(ndviBlob);
  return out;
}

/** Revoca URLs blob: de las bandas de un cube (evita fugas de memoria). */
export function revokeSpectralCubeUrls(bands) {
  if (!bands || typeof bands !== "object") return;
  for (const url of Object.values(bands)) {
    if (typeof url === "string" && url.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        /* ignore */
      }
    }
  }
}

/**
 * Borra un cube en Supabase: filas en capture_images y captures, y archivos
 * en Storage bajo la carpeta del captureId.
 */
export async function deleteSpectralCube(captureId) {
  if (!supabase) {
    throw new Error("Supabase no está configurado");
  }
  if (!captureId || typeof captureId !== "string") {
    throw new Error("Id de capture no válido");
  }

  const { error: imgErr } = await supabase
    .from("capture_images")
    .delete()
    .eq("capture_id", captureId);
  if (imgErr) throw imgErr;

  const { error: capErr } = await supabase
    .from("captures")
    .delete()
    .eq("id", captureId);
  if (capErr) throw capErr;

  const { data: listed, error: listErr } = await supabase.storage
    .from(SPECTRAL_BUCKET)
    .list(captureId);

  if (listErr) {
    console.warn("Storage list al borrar cube:", listErr.message);
    return;
  }

  const paths = (listed ?? [])
    .filter((f) => f.id)
    .map((f) => `${captureId}/${f.name}`);

  if (paths.length === 0) return;

  const { error: rmErr } = await supabase.storage
    .from(SPECTRAL_BUCKET)
    .remove(paths);
  if (rmErr) console.warn("Storage remove al borrar cube:", rmErr.message);
}
