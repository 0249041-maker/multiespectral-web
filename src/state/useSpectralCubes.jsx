import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  clearAllCubesFromIndexedDB,
  loadAllCubesFromIndexedDB,
  removeCubeFromIndexedDB,
  saveCubeToIndexedDB,
} from "@/lib/cubeIndexedDB";
import { computeNdviPngFromFiles } from "@/lib/ndvi";
import {
  deleteSpectralCube,
  localPartialBandUrls,
  persistSpectralCube,
  revokeSpectralCubeUrls,
} from "@/lib/spectralStorage";

function formatCaptureTimestamp(ts) {
  const d = ts ? new Date(ts) : new Date();
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function bandsFromImagesRow(row) {
  if (!row) return null;
  const { img_r, img_g, img_b, img_re, img_nir, img_ndvi } = row;
  if (!img_r && !img_g && !img_b && !img_nir) return null;
  return {
    r: img_r,
    g: img_g,
    b: img_b,
    re: img_re,
    nir: img_nir,
    ndvi: img_ndvi ?? null,
  };
}

/**
 * Carga captures e imágenes en dos consultas (más fiable que el embed anidado
 * si falta la relación FK en PostgREST).
 */
async function loadCubesFromSupabase() {
  if (!supabase) {
    return [];
  }

  const { data: captures, error: capErr } = await supabase
    .from("captures")
    .select("id, timestamp")
    .order("timestamp", { ascending: false })
    .limit(20);

  if (capErr) throw capErr;
  if (!captures?.length) return [];

  const ids = captures.map((c) => c.id);

  let imagesRows = [];
  const withNdvi = await supabase
    .from("capture_images")
    .select("capture_id, img_r, img_g, img_b, img_re, img_nir, img_ndvi")
    .in("capture_id", ids);

  if (withNdvi.error) {
    const msg = `${withNdvi.error.message ?? ""}`;
    if (/img_ndvi|column/i.test(msg)) {
      const basic = await supabase
        .from("capture_images")
        .select("capture_id, img_r, img_g, img_b, img_re, img_nir")
        .in("capture_id", ids);
      if (basic.error) throw basic.error;
      imagesRows = basic.data ?? [];
    } else {
      throw withNdvi.error;
    }
  } else {
    imagesRows = withNdvi.data ?? [];
  }

  const byCapture = new Map();
  for (const row of imagesRows) {
    if (!byCapture.has(row.capture_id)) byCapture.set(row.capture_id, row);
  }

  return captures.map((capture, index) => ({
    id: capture.id,
    label: `Cube ${index + 1}`,
    timestampLabel: formatCaptureTimestamp(capture.timestamp),
    stats: { mean: 0.6, min: -0.95, max: 0.99 },
    bands: bandsFromImagesRow(byCapture.get(capture.id)),
  }));
}

async function loadMergedCubes() {
  let remote = [];
  let supabaseError = null;

  if (supabase) {
    try {
      remote = await loadCubesFromSupabase();
    } catch (e) {
      supabaseError =
        e instanceof Error ? e.message : "No se pudieron cargar los cubes";
    }
  }

  let local = [];
  try {
    local = await loadAllCubesFromIndexedDB();
  } catch {
    local = [];
  }

  const remoteIds = new Set(remote.map((c) => c.id));
  const localOnly = local.filter((c) => !remoteIds.has(c.id));
  const merged = [...remote, ...localOnly];

  return { merged, supabaseError };
}

export function useSpectralCubes() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cubes, setCubes] = useState([]);
  const [selectedCubeId, setSelectedCubeId] = useState(null);
  const [selectedVisualization, setSelectedVisualization] = useState("NDVI");
  const [deletePendingId, setDeletePendingId] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { merged, supabaseError } = await loadMergedCubes();

      if (cancelled) return;

      setCubes(merged);
      setSelectedCubeId(merged[0]?.id ?? null);

      if (supabaseError) {
        if (merged.length > 0) {
          setError(
            `${supabaseError} También se muestran cubes guardados en este navegador.`
          );
        } else {
          setError(supabaseError);
        }
      } else {
        setError(null);
      }

      setLoading(false);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * @param {{ files: { r?: File; g?: File; b?: File; re?: File; nir?: File } }} payload
   */
  const addCubeFromUpload = useCallback(async (payload) => {
    const files = payload.files;
    if (!files.r || !files.nir) {
      throw new Error("Se requieren R y NIR");
    }

    let bands;
    let id;
    let savedToSupabase = false;
    let persistError = null;
    let ndviStats = { mean: 0, min: -1, max: 1 };

    let ndviBlob = null;
    try {
      const result = await computeNdviPngFromFiles(files.r, files.nir);
      ndviBlob = result.blob;
      ndviStats = result.stats;
    } catch (e) {
      throw e;
    }

    if (supabase) {
      try {
        const res = await persistSpectralCube(files, ndviBlob);
        id = res.id;
        bands = res.bands;
        savedToSupabase = true;
      } catch (e) {
        persistError =
          e instanceof Error ? e.message : "No se pudo guardar en Supabase";
        bands = localPartialBandUrls(files, ndviBlob);
        id =
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `local-${Date.now()}`;
      }
    } else {
      bands = localPartialBandUrls(files, ndviBlob);
      id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `local-${Date.now()}`;
      persistError =
        "Sin variables VITE_SUPABASE_* en el build (p. ej. en Vercel → Environment Variables), solo se guarda en este navegador. Añádelas y haz Redeploy.";
    }

    const blobsForIdb = {
      r: files.r,
      g: files.g,
      b: files.b,
      re: files.re,
      nir: files.nir,
      ndvi: ndviBlob,
    };

    setCubes((prev) => {
      const idx = prev.length + 1;
      const label = `Cube ${idx}`;
      const timestampLabel = formatCaptureTimestamp(new Date().toISOString());
      const cube = {
        id,
        label,
        timestampLabel,
        stats: ndviStats,
        bands,
      };

      void saveCubeToIndexedDB(
        id,
        { label, timestampLabel, stats: ndviStats },
        blobsForIdb
      ).catch((e) => console.warn("IndexedDB:", e));

      return [...prev, cube];
    });
    setSelectedCubeId(id);
    setSelectedVisualization("NDVI");

    return { savedToSupabase, persistError };
  }, []);

  const clearLocalCubes = useCallback(async () => {
    try {
      await clearAllCubesFromIndexedDB();
    } catch (e) {
      console.warn("No se pudo borrar IndexedDB:", e);
    }
    const { merged } = await loadMergedCubes();
    setCubes(merged);
    setSelectedCubeId(merged[0]?.id ?? null);
  }, []);

  /**
   * Borra el cube en Supabase (tablas + Storage), en IndexedDB y lo quita de la UI.
   */
  const deleteCubeById = useCallback(async (id) => {
    if (!id) return;
    setDeletePendingId(id);
    try {
      if (supabase) {
        try {
          await deleteSpectralCube(id);
        } catch (e) {
          const msg =
            e instanceof Error ? e.message : "No se pudo borrar en Supabase";
          setError(msg);
          return;
        }
      }

      try {
        await removeCubeFromIndexedDB(id);
      } catch (e) {
        console.warn("IndexedDB al borrar cube:", e);
      }

      setCubes((prev) => {
        const victim = prev.find((c) => c.id === id);
        if (victim?.bands) revokeSpectralCubeUrls(victim.bands);
        const next = prev.filter((c) => c.id !== id);
        setSelectedCubeId((sel) =>
          sel === id ? next[0]?.id ?? null : sel
        );
        return next;
      });
      setError(null);
    } finally {
      setDeletePendingId(null);
    }
  }, []);

  const selectedCube =
    cubes.find((c) => c.id === selectedCubeId) ?? cubes[0] ?? null;

  return {
    cubes,
    selectedCube,
    selectedCubeId,
    setSelectedCubeId,
    selectedVisualization,
    setSelectedVisualization,
    loading,
    error,
    addCubeFromUpload,
    clearLocalCubes,
    deleteCubeById,
    deletePendingId,
  };
}
