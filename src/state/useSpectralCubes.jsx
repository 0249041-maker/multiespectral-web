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
  upsertSpectralCubeBands,
} from "@/lib/spectralStorage";
import { listSpectralCubesFromStorage } from "@/lib/spectralCubesStorage";
import { compensateBandsWithWhiteReference } from "@/lib/whiteReferenceCompensation";
import {
  normalizeSupabaseStorageImageUrl,
  signedUrlFromPublicStorageUrl,
} from "@/lib/supabaseStorageUrl";

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

  if (!withNdvi.error) {
    imagesRows = withNdvi.data ?? [];
  } else {
    // Si falta la columna img_ndvi (400) u otro error en el SELECT amplio, reintenta sin NDVI.
    const basic = await supabase
      .from("capture_images")
      .select("capture_id, img_r, img_g, img_b, img_re, img_nir")
      .in("capture_id", ids);
    if (basic.error) throw basic.error;
    imagesRows = basic.data ?? [];
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
  /** @type {Array<{ id: string }>} */
  let remote = [];
  const errors = [];

  if (supabase) {
    try {
      const fromStorage = await listSpectralCubesFromStorage();
      remote = [...fromStorage];
    } catch (e) {
      errors.push(
        e instanceof Error ? e.message : "No se pudieron listar cubos en Storage"
      );
    }

    try {
      const fromDb = await loadCubesFromSupabase();
      const seen = new Set(remote.map((c) => c.id));
      for (const cube of fromDb) {
        if (!seen.has(cube.id)) {
          seen.add(cube.id);
          remote.push(cube);
        }
      }
    } catch (e) {
      errors.push(
        e instanceof Error ? e.message : "No se pudieron cargar cubos desde la base de datos"
      );
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

  const supabaseError =
    errors.length > 0 && merged.length === 0
      ? errors.join(" · ")
      : errors.length > 0
        ? `${errors[0]} (se muestran otras fuentes si hay datos).`
        : null;

  return { merged, supabaseError };
}

function applyMergedState(
  merged,
  supabaseError,
  setCubes,
  setSelectedCubeId,
  setError,
  selectIdAfter
) {
  setCubes(merged);
  setSelectedCubeId(() => {
    if (selectIdAfter && merged.some((c) => c.id === selectIdAfter)) {
      return selectIdAfter;
    }
    return merged[0]?.id ?? null;
  });
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
}

export function useSpectralCubes() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cubes, setCubes] = useState([]);
  const [selectedCubeId, setSelectedCubeId] = useState(null);
  const [selectedVisualization, setSelectedVisualization] = useState("NDVI");
  const [deletePendingId, setDeletePendingId] = useState(null);

  const refreshCubes = useCallback(async (selectIdAfter = null) => {
    const { merged, supabaseError } = await loadMergedCubes();
    applyMergedState(
      merged,
      supabaseError,
      setCubes,
      setSelectedCubeId,
      setError,
      selectIdAfter
    );
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { merged, supabaseError } = await loadMergedCubes();

      if (cancelled) return;

      applyMergedState(
        merged,
        supabaseError,
        setCubes,
        setSelectedCubeId,
        setError,
        null
      );

      setLoading(false);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * @param {{
   *  files: { r?: Blob; g?: Blob; b?: Blob; re?: Blob; nir?: Blob },
   *  whiteReferenceFiles?: { r?: Blob; g?: Blob; b?: Blob; re?: Blob; nir?: Blob }
   * }} payload
   */
  const addCubeFromUpload = useCallback(
    async (payload) => {
      const rawFiles = payload.files;
      if (!rawFiles.r || !rawFiles.nir) {
        throw new Error("Se requieren R y NIR");
      }
      const whiteReferenceFiles = payload.whiteReferenceFiles ?? {};

      let savedToSupabase = false;
      let persistError = null;
      let ndviStats = { mean: 0, min: -1, max: 1 };
      let compensatedCount = 0;

      let files = rawFiles;
      try {
        const compensated = await compensateBandsWithWhiteReference(
          rawFiles,
          whiteReferenceFiles
        );
        files = compensated.files;
        compensatedCount = compensated.compensatedCount;
      } catch (e) {
        throw e instanceof Error
          ? e
          : new Error("Error al aplicar compensación por referencia blanca.");
      }

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
          savedToSupabase = true;
          await refreshCubes(res.id);
          setSelectedVisualization("NDVI");
          return {
            savedToSupabase: true,
            persistError: null,
            compensatedCount,
          };
        } catch (e) {
          persistError =
            e instanceof Error ? e.message : "No se pudo guardar en Supabase";
        }
      } else {
        persistError =
          "Sin variables VITE_SUPABASE_* en el build (p. ej. en Vercel → Environment Variables), solo se guarda en este navegador. Añádelas y haz Redeploy.";
      }

      const bands = localPartialBandUrls(files, ndviBlob);
      const id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `local-${Date.now()}`;

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

      return { savedToSupabase, persistError, compensatedCount };
    },
    [refreshCubes]
  );

  const clearLocalCubes = useCallback(async () => {
    try {
      await clearAllCubesFromIndexedDB();
    } catch (e) {
      console.warn("No se pudo borrar IndexedDB:", e);
    }
    await refreshCubes();
  }, [refreshCubes]);

  const reprocessSelectedCubeWithWhite = useCallback(
    async (cubeId, whiteReferenceFiles) => {
      const cube = cubes.find((c) => c.id === cubeId);
      if (!cube || !cube.bands) {
        throw new Error("No hay cube seleccionado para reprocesar.");
      }
      if (!cube.bands.r || !cube.bands.nir) {
        throw new Error("El cube seleccionado no tiene bandas R y NIR.");
      }

      const whiteCount = ["r", "g", "b", "re", "nir"].filter(
        (k) => whiteReferenceFiles?.[k]
      ).length;
      if (whiteCount === 0) {
        throw new Error("Primero guarda al menos una banda de referencia blanca.");
      }

      async function blobFromBandUrl(url) {
        if (!url) return null;
        const normalized = normalizeSupabaseStorageImageUrl(url);
        const tryUrls = [normalized];
        const signed = await signedUrlFromPublicStorageUrl(normalized);
        if (signed) tryUrls.unshift(signed);

        let lastErr = null;
        for (const u of tryUrls) {
          try {
            const res = await fetch(u, { credentials: "omit" });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.blob();
          } catch (e) {
            lastErr = e;
          }
        }
        throw new Error(
          `No se pudo descargar una banda del cube seleccionado (${lastErr instanceof Error ? lastErr.message : "error"}).`
        );
      }

      const sourceFiles = {
        r: await blobFromBandUrl(cube.bands.r),
        g: cube.bands.g ? await blobFromBandUrl(cube.bands.g) : null,
        b: cube.bands.b ? await blobFromBandUrl(cube.bands.b) : null,
        re: cube.bands.re ? await blobFromBandUrl(cube.bands.re) : null,
        nir: await blobFromBandUrl(cube.bands.nir),
      };

      const compensated = await compensateBandsWithWhiteReference(
        sourceFiles,
        whiteReferenceFiles ?? {}
      );
      const files = compensated.files;
      const compensatedCount = compensated.compensatedCount;
      if (!files.r || !files.nir) {
        throw new Error("No fue posible compensar R y NIR del cube seleccionado.");
      }

      const ndviResult = await computeNdviPngFromFiles(
        new File([files.r], "r.png", { type: "image/png" }),
        new File([files.nir], "nir.png", { type: "image/png" })
      );
      const ndviBlob = ndviResult.blob;
      const ndviStats = ndviResult.stats;

      const nextBands = localPartialBandUrls(files, ndviBlob);

      setCubes((prev) =>
        prev.map((c) => {
          if (c.id !== cubeId) return c;
          if (c.bands) revokeSpectralCubeUrls(c.bands);
          return {
            ...c,
            bands: nextBands,
            stats: ndviStats,
          };
        })
      );
      setSelectedVisualization("NDVI");

      // Guarda local para persistir en este navegador.
      try {
        await saveCubeToIndexedDB(
          cubeId,
          {
            label: cube.label,
            timestampLabel: cube.timestampLabel,
            stats: ndviStats,
          },
          {
            r: files.r,
            g: files.g,
            b: files.b,
            re: files.re,
            nir: files.nir,
            ndvi: ndviBlob,
          }
        );
      } catch (e) {
        console.warn("IndexedDB al reprocesar cube:", e);
      }

      // Si existe en Supabase (id no local), también persiste en servidor.
      if (supabase && !String(cubeId).startsWith("local-")) {
        try {
          const res = await upsertSpectralCubeBands(cubeId, files, ndviBlob);
          setCubes((prev) =>
            prev.map((c) => (c.id === cubeId ? { ...c, bands: res.bands, stats: ndviStats } : c))
          );
        } catch (e) {
          const msg =
            e instanceof Error
              ? e.message
              : "No se pudo guardar reproceso en Supabase";
          setError(msg);
        }
      }

      return { compensatedCount };
    },
    [cubes]
  );

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
    refreshCubes,
    reprocessSelectedCubeWithWhite,
  };
}
