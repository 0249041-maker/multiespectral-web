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
