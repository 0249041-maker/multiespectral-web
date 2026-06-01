import SpectralBandColorized from "@/components/advanced/SpectralBandColorized";
import SpectralComputedIndex from "@/components/advanced/SpectralComputedIndex";
import SpectralNdviComposite from "@/components/advanced/SpectralNdviComposite";
import SpectralRgbComposite from "@/components/advanced/SpectralRgbComposite";
import SupabaseImage from "@/components/advanced/SupabaseImage";
import { useCameraDashboard } from "@/context/CameraDashboardContext";
import { useStrawberryDetection } from "@/context/StrawberryDetectionContext";
import {
  extractCompensatorsFromMetadata,
  fetchCubeMetadata,
  normalizeCompensators,
} from "@/lib/cubeCompensators";
import { supabase } from "@/lib/supabase";
import {
  DEFAULT_MATURITY_THRESHOLDS,
  getMaturityThresholds,
  setMaturityThresholds,
} from "@/lib/strawberryMaturity";
import { useSpectralCubes } from "@/state/useSpectralCubes";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";

const StrawberryDetectionLab = lazy(() =>
  import("@/components/StrawberryDetectionLab.jsx")
);

const VISUALIZATIONS = [
  "RGB natural",
  "RGB multiespectral",
  "NDVI",
  "NDRE",
  "NDRI",
  "NDGI",
  "CI_re",
  "SIPI",
  "VARI",
  "GNDVI",
  "MSR",
  "Cl_green",
  "MTCI",
  "EVI",
  "ARVI",
  "Cl Red",
  "BLUE",
  "GREEN",
  "RED",
  "RE",
  "NIR",
];

const BAND_BY_VIZ = {
  RED: "r",
  GREEN: "g",
  BLUE: "b",
  RE: "re",
  NIR: "nir",
};

// La mínima intensidad siempre es negro y la máxima el color seleccionado.
const BAND_COLOR_MAP = {
  BLUE: { start: "#000000", end: "#1E40FF", colorLabel: "Azul" },
  GREEN: { start: "#000000", end: "#22C55E", colorLabel: "Verde" },
  RED: { start: "#000000", end: "#EF4444", colorLabel: "Rojo" },
  RE: { start: "#000000", end: "#FF00FF", colorLabel: "Magenta" },
  NIR: { start: "#000000", end: "#FFFFFF", colorLabel: "Blanco" },
};

const INDEX_LABELS = new Set([
  "NDRE",
  "NDRI",
  "NDGI",
  "NDVI",
  "MSR",
  "Cl_green",
  "MTCI",
  "EVI",
  "ARVI",
  "Cl Red",
]);

const COMPUTED_INDEX_KEYS = new Set(["GNDVI", "CI_re", "SIPI", "VARI"]);
const MATURITY_STORAGE_KEY = "maturity-thresholds-v1";

function isRgbVisualization(v) {
  return v === "RGB natural" || v === "RGB multiespectral";
}

function isBandVisualization(v) {
  return Boolean(BAND_BY_VIZ[v]);
}

function SpectralImagePreview({ visualization, bands, empty, onComputedStats, compensators }) {
  if (empty || !bands) {
    if (empty) {
      return (
        <p className="max-w-sm text-center text-sm text-slate-400">
          Selecciona un cube del instrumento para ver la visualización.
        </p>
      );
    }
    return (
      <div className="h-[clamp(14rem,20vw,28rem)] w-[clamp(14rem,20vw,28rem)] rounded-full bg-gradient-to-tr from-slate-700 via-slate-100 to-slate-800" />
    );
  }

  if (visualization === "NDVI" && bands.r && bands.nir) {
    return (
      <div className="flex max-w-full flex-col items-center gap-3 sm:flex-row sm:items-stretch sm:justify-center sm:gap-4">
        <SpectralNdviComposite
          bands={bands}
          compensators={compensators}
          className="max-h-[min(70vh,32rem)] max-w-full rounded-lg object-contain shadow-lg"
        />
      </div>
    );
  }

  if (visualization === "NDVI" && bands.ndvi) {
    return (
      <div className="flex max-w-full flex-col items-center gap-3 sm:flex-row sm:items-stretch sm:justify-center sm:gap-4">
        <SupabaseImage
          src={bands.ndvi}
          alt="Mapa NDVI"
          className="max-h-[min(70vh,32rem)] max-w-full rounded-lg object-contain shadow-lg"
        />
      </div>
    );
  }

  if (isRgbVisualization(visualization) && bands.r && bands.g && bands.b) {
    const fullFive = Boolean(bands.re && bands.nir);
    const natural = visualization === "RGB natural";
    return (
      <SpectralRgbComposite
        bands={bands}
        mode={natural ? "natural" : "multispectral"}
        publishForDetection={natural}
        className="max-h-[min(70vh,32rem)] w-full rounded-lg object-contain shadow-lg"
        caption={
          natural
            ? "RGB natural: canales R, G y B alineados a la banda R."
            : fullFive
              ? "RGB multiespectral: el rojo de pantalla mezcla NIR+R+RE; G y B alineados a R."
              : "RGB multiespectral usa RGB natural cuando faltan RE/NIR."
        }
      />
    );
  }

  const bandKey = BAND_BY_VIZ[visualization];
  if (bandKey && bands[bandKey]) {
    const palette = BAND_COLOR_MAP[visualization];
    if (palette) {
      return (
        <SpectralBandColorized
          src={bands[bandKey]}
          startHex={palette.start}
          endHex={palette.end}
          alt={`Canal ${visualization} coloreado por intensidad`}
          className="max-h-[min(70vh,32rem)] max-w-full rounded-lg object-contain shadow-lg"
        />
      );
    }
    return (
      <SupabaseImage
        src={bands[bandKey]}
        alt={`Canal ${visualization}`}
        className="max-h-[min(70vh,32rem)] max-w-full rounded-lg object-contain shadow-lg"
      />
    );
  }

  if (COMPUTED_INDEX_KEYS.has(visualization)) {
    return (
      <SpectralComputedIndex
        visualization={visualization}
        bands={bands}
        compensators={compensators}
        onStats={onComputedStats}
        className="max-h-[min(70vh,32rem)] max-w-full rounded-lg object-contain shadow-lg"
      />
    );
  }

  if (INDEX_LABELS.has(visualization)) {
    return (
      <div className="flex max-w-md flex-col items-center gap-3 text-center">
        <p className="text-sm text-slate-300">
          Índice <span className="font-semibold text-white">{visualization}</span>
          : el cálculo espectral aún no está aplicado.{" "}
          {visualization === "NDVI"
            ? "Sube R + NIR arriba o revisa que este cube tenga NDVI guardado en Supabase."
            : "Puedes usar NIR como referencia visual."}
        </p>
        {bands.nir ? (
          <SupabaseImage
            src={bands.nir}
            alt="NIR referencia"
            className="max-h-[min(50vh,24rem)] max-w-full rounded-lg object-contain opacity-90"
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="h-[clamp(14rem,20vw,28rem)] w-[clamp(14rem,20vw,28rem)] rounded-full bg-gradient-to-tr from-slate-700 via-slate-100 to-slate-800" />
  );
}

function BandLegend({ visualization }) {
  const palette = BAND_COLOR_MAP[visualization];
  if (!palette) return null;
  return (
    <div className="mt-4 flex items-center gap-3">
      <span className="text-[11px] text-slate-500">Negro</span>
      <div
        className="h-2 flex-1 rounded-full"
        style={{
          background: `linear-gradient(to right, ${palette.start}, ${palette.end})`,
        }}
      />
      <span className="text-[11px] text-slate-500">{palette.colorLabel}</span>
    </div>
  );
}

function IndexLegend({ visualization }) {
  const dynamicScale =
    visualization === "CI_re" || visualization === "SIPI";
  return (
    <div className="mt-4 space-y-1">
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 rounded-full bg-gradient-to-r from-red-500 via-yellow-300 to-emerald-500" />
        {dynamicScale ? (
          <>
            <span className="text-[11px] text-slate-500">mín</span>
            <span className="text-[11px] text-slate-500">máx</span>
          </>
        ) : (
          <>
            <span className="text-[11px] text-slate-500">-1.0</span>
            <span className="text-[11px] text-slate-500">+1.0</span>
          </>
        )}
      </div>
      {dynamicScale ? (
        <p className="text-[10px] text-slate-500">
          Colormap lineal del mínimo al máximo de esta imagen.
        </p>
      ) : null}
    </div>
  );
}

const COMP_NM_BY_KEY = { b: 450, g: 550, r: 656, re: 725, nir: 850 };
const COMP_ROWS_ORDER = ["b", "g", "r", "re", "nir"];

function CompensatorsTable({ compensators, source }) {
  const hasAny = compensators
    ? COMP_ROWS_ORDER.some((k) => Number.isFinite(Number(compensators[k])))
    : false;
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">
          Compensadores blancos
        </p>
        <span className="text-[10px] text-slate-500">origen: {source}</span>
      </div>
      {hasAny ? (
        <div className="overflow-hidden rounded border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-[10px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-2 py-1.5 font-semibold">nm</th>
                <th className="px-2 py-1.5 font-semibold">Banda</th>
                <th className="px-2 py-1.5 font-semibold">Valor (0–255)</th>
                <th className="px-2 py-1.5 font-semibold">Factor (255 / val)</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {COMP_ROWS_ORDER.map((k) => {
                const v = Number(compensators?.[k]);
                const valid = Number.isFinite(v) && v > 0;
                return (
                  <tr key={k} className="border-t border-slate-100">
                    <td className="px-2 py-1.5 font-mono text-slate-700">
                      {COMP_NM_BY_KEY[k]}
                    </td>
                    <td className="px-2 py-1.5 font-mono uppercase text-slate-700">
                      {k}
                    </td>
                    <td className="px-2 py-1.5 font-mono text-slate-800">
                      {valid ? v.toFixed(0) : "—"}
                    </td>
                    <td className="px-2 py-1.5 font-mono text-slate-600">
                      {valid ? (255 / v).toFixed(3) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-[11px] text-slate-500">
          Sin compensadores disponibles. Los índices se calculan sin
          compensación (factor 1).
        </p>
      )}
    </div>
  );
}

function FullMetadataBlock({ json }) {
  if (json == null) return null;
  let pretty = "";
  try {
    pretty = JSON.stringify(json, null, 2);
  } catch {
    pretty = String(json);
  }
  return (
    <details className="rounded-lg border border-slate-200 bg-slate-50/60">
      <summary className="cursor-pointer rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-100">
        metadata.json (completo)
      </summary>
      <pre className="max-h-72 overflow-auto rounded-b-lg bg-slate-900 px-3 py-2 text-[11px] leading-relaxed text-slate-100">
        {pretty}
      </pre>
    </details>
  );
}

function CubeMetadataPanel({ cube, onSaveName, onClose, activeCompensators }) {
  const [name, setName] = useState(cube?.label ?? "");
  const [rawMetadata, setRawMetadata] = useState(null);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [metadataError, setMetadataError] = useState(null);

  useEffect(() => {
    setName(cube?.label ?? "");
  }, [cube?.id, cube?.label]);

  useEffect(() => {
    let cancelled = false;
    setRawMetadata(null);
    setMetadataError(null);

    if (!cube?.metadataUrl) {
      setMetadataLoading(false);
      return undefined;
    }

    setMetadataLoading(true);
    fetchCubeMetadata(cube.metadataUrl)
      .then((json) => {
        if (cancelled) return;
        if (json == null) {
          setMetadataError(
            "No se pudo leer metadata.json (no existe o el navegador no pudo descargarlo)."
          );
        } else {
          setRawMetadata(json);
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setMetadataError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setMetadataLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cube?.id, cube?.metadataUrl]);

  if (!cube) return null;

  const compFromMetadata = rawMetadata
    ? extractCompensatorsFromMetadata(rawMetadata)
    : null;
  const compFromCube = cube.compensators ?? null;
  const comp = compFromMetadata ?? compFromCube ?? activeCompensators ?? null;
  const compSource = compFromMetadata
    ? "metadata.json del cube"
    : compFromCube
      ? "cube (cache de metadata)"
      : activeCompensators
        ? "calibración blanca activa"
        : "sin compensación (factor 1)";

  const handleSave = () => {
    const next = name.trim();
    if (!next || next === cube.label) {
      onClose?.();
      return;
    }
    onSaveName?.(cube.id, next);
    onClose?.();
  };

  return (
    <div className="flex max-w-3xl flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 text-left text-sm text-slate-800 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-base font-semibold text-slate-900">
          Metadata del cube
        </p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
        >
          Cerrar
        </button>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-[11px] uppercase tracking-wide text-slate-500">
          Nombre del cube
        </span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
        />
        <button
          type="button"
          onClick={handleSave}
          className="self-start rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
        >
          Guardar nombre
        </button>
      </label>

      <CompensatorsTable compensators={comp} source={compSource} />

      <dl className="grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-slate-500">
            ID
          </dt>
          <dd className="break-all font-mono text-[11px] text-slate-700">
            {cube.id}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-slate-500">
            Captura
          </dt>
          <dd className="text-slate-700">{cube.timestampLabel || "—"}</dd>
        </div>
        {cube.cameraId ? (
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-slate-500">
              Cámara
            </dt>
            <dd className="text-slate-700">{cube.cameraId}</dd>
          </div>
        ) : null}
        {cube.storagePath ? (
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-slate-500">
              Ruta en Storage
            </dt>
            <dd className="break-all font-mono text-[11px] text-slate-700">
              {cube.storagePath}
            </dd>
          </div>
        ) : null}
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-slate-500">
            Bandas disponibles
          </dt>
          <dd className="text-slate-700">
            {["r", "g", "b", "re", "nir", "ndvi"]
              .filter((k) => cube.bands?.[k])
              .map((k) => k.toUpperCase())
              .join(", ") || "—"}
          </dd>
        </div>
        {cube.stats?.mean != null ? (
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-slate-500">
              Stats NDVI
            </dt>
            <dd className="text-slate-700">
              media {cube.stats.mean.toFixed(2)} · mín{" "}
              {cube.stats.min?.toFixed?.(2) ?? "—"} · máx{" "}
              {cube.stats.max?.toFixed?.(2) ?? "—"}
            </dd>
          </div>
        ) : null}
        {cube.metadataUrl ? (
          <div className="sm:col-span-2">
            <dt className="text-[11px] uppercase tracking-wide text-slate-500">
              URL del metadata.json
            </dt>
            <dd className="break-all font-mono text-[11px] text-sky-700">
              <a href={cube.metadataUrl} target="_blank" rel="noreferrer">
                {cube.metadataUrl}
              </a>
            </dd>
          </div>
        ) : null}
      </dl>

      {metadataLoading ? (
        <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
          Cargando metadata.json…
        </p>
      ) : metadataError ? (
        <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
          {metadataError}
        </p>
      ) : rawMetadata ? (
        <FullMetadataBlock json={rawMetadata} />
      ) : null}
    </div>
  );
}

function MaturityThresholdsDetails({
  maturityUi,
  onChange,
  onReset,
}) {
  return (
    <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
      <summary className="cursor-pointer text-sm font-semibold text-slate-800">
        Ajuste manual de umbrales de madurez
      </summary>
      <p className="mt-2 text-xs text-slate-600">
        Clasificación por tabla GNDVI/CIre con transición graduada alrededor de cada umbral para evitar cortes bruscos.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {[
          ["gndviHighMin", "GNDVI: umbral de Alto"],
          ["cireHighMin", "CIre: umbral de Alto"],
          ["gndviTransitionWidth", "GNDVI: ancho transición"],
          ["cireTransitionWidth", "CIre: ancho transición"],
        ].map(([key, label]) => (
          <label
            key={key}
            className="flex min-w-[160px] flex-1 flex-col gap-1 rounded border border-slate-200 bg-white p-2"
          >
            <span className="text-[11px] text-slate-600">{label}</span>
            <input
              type="number"
              step={0.001}
              value={maturityUi[key]}
              onChange={(e) => onChange(key, e.target.value)}
              className="rounded border border-slate-300 px-2 py-1 text-sm text-slate-800"
            />
          </label>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onReset}
          className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100"
        >
          Restaurar valores por defecto
        </button>
      </div>
    </details>
  );
}

export default function AdvancedMode({ uiVisible = true } = {}) {
  const {
    setSpectralCubeBands,
    setSpectralCubeCompensators,
    setSpectralCubeSelection,
    setSelectedCubeNdviStats,
  } = useStrawberryDetection();
  const dash = useCameraDashboard();
  const activeCompensators = useMemo(
    () => normalizeCompensators(dash?.activeWhiteReference?.compensators),
    [dash?.activeWhiteReference?.compensators]
  );
  const [computedIndexStats, setComputedIndexStats] = useState(null);
  const [maturityUi, setMaturityUi] = useState(() => getMaturityThresholds());
  const [showCubeMetadata, setShowCubeMetadata] = useState(false);
  const {
    cubes,
    selectedCube,
    selectedCubeId,
    setSelectedCubeId,
    selectedVisualization,
    setSelectedVisualization,
    loading,
    error,
    clearLocalCubes,
    deleteCubeById,
    deletePendingId,
    renameCube,
  } = useSpectralCubes();

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(MATURITY_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const next = setMaturityThresholds(parsed);
      setMaturityUi(next);
    } catch {
      // ignore malformed local storage
    }
  }, []);

  useEffect(() => {
    setComputedIndexStats(null);
  }, [selectedVisualization, selectedCube?.id]);

  useEffect(() => {
    setShowCubeMetadata(false);
  }, [selectedCube?.id]);

  const setThresholdValue = (key, value) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return;
    const next = setMaturityThresholds({ [key]: num });
    setMaturityUi(next);
    try {
      window.localStorage.setItem(MATURITY_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore storage quota/private mode
    }
  };

  const resetMaturityThresholds = () => {
    const next = setMaturityThresholds(DEFAULT_MATURITY_THRESHOLDS);
    setMaturityUi(next);
    try {
      window.localStorage.setItem(MATURITY_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
  };

  useEffect(() => {
    setSpectralCubeSelection({
      id: selectedCube?.id ?? null,
      label: selectedCube?.label ?? null,
    });
  }, [selectedCube?.id, selectedCube?.label, setSpectralCubeSelection]);

  useEffect(() => {
    const stats = selectedCube?.stats;
    if (
      stats &&
      typeof stats.mean === "number" &&
      typeof stats.min === "number" &&
      typeof stats.max === "number"
    ) {
      setSelectedCubeNdviStats({
        mean: stats.mean,
        min: stats.min,
        max: stats.max,
      });
    } else {
      setSelectedCubeNdviStats(null);
    }
  }, [selectedCube?.id, selectedCube?.stats, setSelectedCubeNdviStats]);

  useEffect(() => {
    const b = selectedCube?.bands;
    if (b?.r && b?.g && b?.b && b?.re && b?.nir) {
      setSpectralCubeBands({
        r: b.r,
        g: b.g,
        b: b.b,
        re: b.re,
        nir: b.nir,
      });
    } else {
      setSpectralCubeBands(null);
    }
    return () => setSpectralCubeBands(null);
  }, [selectedCube?.bands, selectedCube?.id, setSpectralCubeBands]);

  const effectiveCompensators = useMemo(
    () => selectedCube?.compensators ?? activeCompensators ?? null,
    [selectedCube?.compensators, activeCompensators]
  );

  useEffect(() => {
    setSpectralCubeCompensators(effectiveCompensators);
    return () => setSpectralCubeCompensators(null);
  }, [effectiveCompensators, setSpectralCubeCompensators]);

  const statsCube = selectedCube ?? cubes[0];

  if (!uiVisible) {
    return null;
  }

  const rgbView = isRgbVisualization(selectedVisualization);
  const bandView = isBandVisualization(selectedVisualization);

  return (
    <section
      aria-label="Modo avanzado multiespectral"
      className="mt-4 space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Modo avanzado</h2>
      </div>

      {!supabase && (
        <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
          <p className="font-semibold text-amber-900">
            Supabase no está activo en esta versión publicada
          </p>
          <p className="mt-1 text-sm text-amber-800">
            Por eso los cubes solo se guardan en <strong>este navegador</strong>{" "}
            (IndexedDB) y otras personas u otros dispositivos no los ven. Define{" "}
            <code className="rounded bg-amber-100 px-1">VITE_SUPABASE_URL</code>{" "}
            y <code className="rounded bg-amber-100 px-1">VITE_SUPABASE_ANON_KEY</code>{" "}
            y haz Redeploy para activar la nube.
          </p>
        </div>
      )}

      {loading && (
        <p className="text-sm text-slate-500">
          Cargando cubes multiespectrales…
        </p>
      )}
      {error && !loading && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          No se pudieron cargar cubes desde Supabase ({error}).
        </p>
      )}

      {!loading && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h3 className="text-lg font-semibold text-slate-900">
              Selección de cube espectral
            </h3>
            {selectedCube ? (
              <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-medium text-slate-50">
                {selectedVisualization}
              </span>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-[220px,1fr]">
            <aside className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Spectral cubes
              </p>
              {cubes.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">
                  Sin cubes en este navegador o en la nube.
                </p>
              ) : (
                <div className="max-h-[24rem] space-y-1 overflow-y-auto pr-1">
                  {cubes.map((cube) => (
                    <div
                      key={cube.id}
                      className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5"
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedCubeId(cube.id)}
                        className={`flex min-w-0 flex-1 flex-col rounded-md border border-transparent px-2 py-2 text-left text-xs ${
                          cube.id === selectedCubeId
                            ? "border-emerald-400 bg-emerald-50 text-emerald-900"
                            : "text-slate-700 hover:border-emerald-200 hover:bg-white"
                        }`}
                      >
                        <span className="font-semibold">{cube.label}</span>
                        <span className="text-[11px] text-slate-500">
                          {cube.timestampLabel}
                        </span>
                      </button>
                      <div className="flex w-full gap-1 px-1 pb-1 sm:w-auto sm:flex-col sm:px-0 sm:pb-0">
                        <button
                          type="button"
                          aria-label={`Ver más ${cube.label}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCubeId(cube.id);
                            setShowCubeMetadata(true);
                          }}
                          className="flex-1 shrink-0 rounded-md border border-sky-200 bg-white px-2 py-1 text-[11px] font-medium text-sky-700 hover:bg-sky-50"
                        >
                          Ver más
                        </button>
                        <button
                          type="button"
                          disabled={deletePendingId === cube.id}
                          aria-label={`Borrar ${cube.label}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            const msg = supabase
                              ? "¿Borrar este cube? Se eliminará de la base de datos, del almacenamiento de imágenes y de este navegador."
                              : "¿Borrar este cube solo de este navegador? (Sin Supabase no hay copia en servidor.)";
                            if (!window.confirm(msg)) return;
                            void deleteCubeById(cube.id);
                          }}
                          className="flex-1 shrink-0 rounded-md border border-red-200 bg-white px-2 py-1 text-[11px] font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          {deletePendingId === cube.id ? "…" : "Borrar"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={clearLocalCubes}
                className="mt-2 w-full rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              >
                Borrar cubes guardados en este navegador
              </button>
            </aside>

            <div className="grid gap-4 md:grid-cols-[minmax(0,2fr),minmax(0,1fr)]">
              <div className="flex min-w-0 flex-col rounded-xl border border-slate-200 bg-slate-950/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Vista por imagen
                </p>
                <div className="mt-4 flex min-h-[min(50vh,20rem)] flex-1 items-center justify-center rounded-xl bg-slate-900 p-4 sm:p-6">
                  {showCubeMetadata && selectedCube ? (
                    <CubeMetadataPanel
                      cube={selectedCube}
                      activeCompensators={activeCompensators}
                      onSaveName={renameCube}
                      onClose={() => setShowCubeMetadata(false)}
                    />
                  ) : (
                    <SpectralImagePreview
                      visualization={selectedVisualization}
                      bands={statsCube?.bands ?? null}
                      compensators={
                        statsCube?.compensators ?? activeCompensators ?? null
                      }
                      empty={cubes.length === 0}
                      onComputedStats={setComputedIndexStats}
                    />
                  )}
                </div>

                {/* Leyenda según tipo de visualización */}
                {cubes.length > 0 && !showCubeMetadata && !rgbView ? (
                  bandView ? (
                    <BandLegend visualization={selectedVisualization} />
                  ) : (
                    <IndexLegend visualization={selectedVisualization} />
                  )
                ) : null}

                {/* Stats opcionales para índices calculados */}
                {!showCubeMetadata &&
                COMPUTED_INDEX_KEYS.has(selectedVisualization) &&
                computedIndexStats ? (
                  <p className="mt-2 text-[11px] text-slate-500">
                    media {computedIndexStats.mean.toFixed(3)} · mín{" "}
                    {computedIndexStats.min.toFixed(3)} · máx{" "}
                    {computedIndexStats.max.toFixed(3)}
                  </p>
                ) : null}
              </div>

              <div className="flex min-w-0 flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Filtros / visualización
                </p>
                <div className="max-h-[24rem] overflow-y-auto pr-1">
                  <ul className="space-y-1">
                    {VISUALIZATIONS.map((v) => {
                      const active = v === selectedVisualization;
                      return (
                        <li key={v}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedVisualization(v);
                              setShowCubeMetadata(false);
                            }}
                            disabled={cubes.length === 0}
                            className={`w-full rounded-md border px-3 py-1.5 text-left text-xs transition disabled:opacity-50 ${
                              active
                                ? "border-emerald-400 bg-emerald-50 text-emerald-900"
                                : "border-slate-200 bg-white text-slate-700 hover:border-emerald-200 hover:bg-emerald-50/40"
                            }`}
                          >
                            {v}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <Suspense
        fallback={
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-center text-sm text-slate-500">
            Cargando panel de detección…
          </p>
        }
      >
        <StrawberryDetectionLab>
          <MaturityThresholdsDetails
            maturityUi={maturityUi}
            onChange={setThresholdValue}
            onReset={resetMaturityThresholds}
          />
        </StrawberryDetectionLab>
      </Suspense>
    </section>
  );
}
