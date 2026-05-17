import CubeUploadPanel from "@/components/advanced/CubeUploadPanel";
import SpectralBandColorized from "@/components/advanced/SpectralBandColorized";
import SpectralComputedIndex from "@/components/advanced/SpectralComputedIndex";
import SpectralNdviComposite from "@/components/advanced/SpectralNdviComposite";
import SpectralRgbComposite from "@/components/advanced/SpectralRgbComposite";
import SupabaseImage from "@/components/advanced/SupabaseImage";
import { useStrawberryDetection } from "@/context/StrawberryDetectionContext";
import { supabase } from "@/lib/supabase";
import {
  DEFAULT_MATURITY_THRESHOLDS,
  getMaturityThresholds,
  setMaturityThresholds,
} from "@/lib/strawberryMaturity";
import { useSpectralCubes } from "@/state/useSpectralCubes";
import { lazy, Suspense, useEffect, useState } from "react";

const StrawberryDetectionLab = lazy(() =>
  import("@/components/StrawberryDetectionLab.jsx")
);

const VISUALIZATIONS = [
  "NDRE",
  "NDRI",
  "NDGI",
  "CI_re",
  "SIPI",
  "VARI",
  "NDVI",
  "GNDVI",
  "MSR",
  "Cl_green",
  "MTCI",
  "EVI",
  "ARVI",
  "Cl Red",
  "RGB natural",
  "RGB multiespectral",
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

const BAND_COLOR_MAP = {
  // Pedido del usuario: 450 azul->negro, 550 verde->negro, 656 rojo->negro,
  // 725 negro->magenta, 850 blanco->negro
  BLUE: { start: "#1E40FF", end: "#000000" },
  GREEN: { start: "#22C55E", end: "#000000" },
  RED: { start: "#EF4444", end: "#000000" },
  RE: { start: "#000000", end: "#FF00FF" },
  NIR: { start: "#FFFFFF", end: "#000000" },
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

/** Índices calculados al vuelo desde bandas (menú desplegable). */
const COMPUTED_INDEX_KEYS = new Set(["GNDVI", "CI_re", "SIPI", "VARI"]);
const MATURITY_STORAGE_KEY = "maturity-thresholds-v1";

function SpectralImagePreview({ visualization, bands, empty, onComputedStats }) {
  if (empty || !bands) {
    if (empty) {
      return (
        <p className="max-w-sm text-center text-sm text-slate-400">
          Sube imágenes arriba (mínimo R y NIR) para ver la visualización. Usa
          el desplegable para elegir NDVI u otro índice cuando tengas un cube.
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
          className="max-h-[min(70vh,32rem)] max-w-full rounded-lg object-contain shadow-lg"
        />
        <div
          className="flex h-[min(50vh,24rem)] min-h-[180px] flex-row items-stretch justify-center gap-2 sm:h-auto sm:min-h-[min(50vh,24rem)] sm:w-14 sm:flex-col sm:items-center sm:py-1"
          aria-hidden
        >
          <span className="self-center text-[10px] font-medium text-slate-300 sm:order-1">
            1.0
          </span>
          <div
            className="mx-auto w-full max-w-[12rem] flex-1 rounded border border-white/25 sm:order-2 sm:max-w-none sm:flex-1 sm:self-stretch"
            style={{
              background:
                "linear-gradient(to top, rgb(139,0,0) 0%, rgb(255,200,80) 50%, rgb(0,109,44) 100%)",
            }}
          />
          <span className="self-center text-[10px] font-medium text-slate-300 sm:order-3">
            -1.0
          </span>
        </div>
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
        <div
          className="flex h-[min(50vh,24rem)] min-h-[180px] flex-row items-stretch justify-center gap-2 sm:h-auto sm:min-h-[min(50vh,24rem)] sm:w-14 sm:flex-col sm:items-center sm:py-1"
          aria-hidden
        >
          <span className="self-center text-[10px] font-medium text-slate-300 sm:order-1">
            1.0
          </span>
          <div
            className="mx-auto w-full max-w-[12rem] flex-1 rounded border border-white/25 sm:order-2 sm:max-w-none sm:flex-1 sm:self-stretch"
            style={{
              background:
                "linear-gradient(to top, rgb(139,0,0) 0%, rgb(255,200,80) 50%, rgb(0,109,44) 100%)",
            }}
          />
          <span className="self-center text-[10px] font-medium text-slate-300 sm:order-3">
            -1.0
          </span>
        </div>
      </div>
    );
  }

  if (
    (visualization === "RGB natural" ||
      visualization === "RGB multiespectral") &&
    bands.r &&
    bands.g &&
    bands.b
  ) {
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
            ? "RGB natural: canales de pantalla R, G y B alineados a la banda R."
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

export default function AdvancedMode({
  uiVisible = true,
  onOpenCamera,
} = {}) {
  const {
    setSpectralCubeBands,
    setSpectralCubeSelection,
    setSelectedCubeNdviStats,
  } = useStrawberryDetection();
  const [computedIndexStats, setComputedIndexStats] = useState(null);
  const [maturityUi, setMaturityUi] = useState(() => getMaturityThresholds());
  const {
    cubes,
    selectedCube,
    selectedCubeId,
    setSelectedCubeId,
    selectedVisualization,
    setSelectedVisualization,
    loading,
    error,
    addCubeFromUpload,
    reprocessSelectedCubeWithWhite,
    clearLocalCubes,
    deleteCubeById,
    deletePendingId,
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

  const handleCubeAccepted = async (payload) => {
    return addCubeFromUpload({
      files: payload.files,
      whiteReferenceFiles: payload.whiteReferenceFiles,
    });
  };

  const handleApplyWhiteToSelected = async (whiteReferenceFiles) => {
    if (!selectedCube?.id) {
      throw new Error("Selecciona un cube antes de aplicar referencia blanca.");
    }
    return reprocessSelectedCubeWithWhite(selectedCube.id, whiteReferenceFiles);
  };

  const statsCube = selectedCube ?? cubes[0];

  if (!uiVisible) {
    return null;
  }

  return (
    <section
      aria-label="Modo avanzado multiespectral"
      className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="mb-4 space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Modo avanzado (técnico)
          </h2>
          <p className="text-sm text-slate-500">
            Visualización detallada de cubes multiespectrales y sus índices.
          </p>
        </div>
        {typeof onOpenCamera === "function" ? (
          <button
            type="button"
            onClick={onOpenCamera}
            className="inline-flex w-full items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-100 sm:w-auto sm:justify-start"
          >
            Agregar cámara
          </button>
        ) : null}
      </div>

      <div className="mb-6 border-t border-slate-100 pt-5">
        <Suspense
          fallback={
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-center text-sm text-slate-500">
              Cargando panel de detección…
            </p>
          }
        >
          <StrawberryDetectionLab />
        </Suspense>
      </div>

      {supabase && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50/90 p-4">
          <p className="text-sm font-medium text-emerald-900">
            Cubes en la nube (Supabase)
          </p>
          <p className="mt-1 text-sm text-emerald-800">
            Los cubos del instrumento se guardan en{" "}
            <code className="rounded bg-white px-1 text-xs">
              {import.meta.env.VITE_SUPABASE_SPECTRAL_BUCKET || "capture_image"}
            </code>{" "}
            como{" "}
            <span className="font-mono text-xs">
              camera_001/cube_YYYYMMDD_HHMMSS/450.bmp … 850.bmp
            </span>{" "}
            (+ metadata.json). Las subidas manuales desde la web siguen usando{" "}
            <code className="rounded bg-white px-1 text-xs">captures</code> /{" "}
            <code className="rounded bg-white px-1 text-xs">capture_images</code>.
          </p>
        </div>
      )}

      {!supabase && (
        <div className="mb-4 rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
          <p className="font-semibold text-amber-900">
            Supabase no está activo en esta versión publicada
          </p>
          <p className="mt-1 text-sm text-amber-800">
            Por eso los cubes solo se guardan en <strong>este navegador</strong>{" "}
            (IndexedDB) y otras personas u otros dispositivos no los ven.
          </p>
          <p className="mt-2 text-sm text-amber-900">
            <strong>Si usas Vercel:</strong> el archivo <code>.env</code> de tu
            PC no se sube a internet. Ve a tu proyecto en{" "}
            <strong>Vercel → Settings → Environment Variables</strong> y añade
            (para <strong>Production</strong> y, si quieres, Preview):
          </p>
          <ul className="mt-2 list-inside list-disc text-sm text-amber-800">
            <li>
              <code className="rounded bg-amber-100 px-1">VITE_SUPABASE_URL</code>{" "}
              = la URL de tu proyecto Supabase
            </li>
            <li>
              <code className="rounded bg-amber-100 px-1">
                VITE_SUPABASE_ANON_KEY
              </code>{" "}
              = la anon key (pública). El nombre debe ser exactamente ese, con{" "}
              <strong>KEY</strong> al final (no <code>VITE_SUPABASE_ANON_KE</code>
              ).
            </li>
          </ul>
          <p className="mt-2 text-sm text-amber-800">
            Después pulsa <strong>Redeploy</strong> en el último deployment (las
            variables Vite solo se aplican al construir el sitio).
          </p>
          <p className="mt-2 text-xs text-amber-700">
            En Supabase, ejecuta también{" "}
            <code className="rounded bg-amber-100 px-1">
              supabase/configurar_acceso_publico.sql
            </code>{" "}
            para que cualquiera pueda leer los cubes. En local, usa un archivo{" "}
            <code className="rounded bg-amber-100 px-1">.env</code> con las
            mismas variables.
          </p>
        </div>
      )}

      <CubeUploadPanel
        onCubeAccepted={handleCubeAccepted}
        onApplyWhiteToSelected={handleApplyWhiteToSelected}
        hasSelectedCube={Boolean(selectedCube)}
        disabled={loading}
      />

      <details className="mb-4 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-slate-800">
          Ajuste manual de umbrales de madurez
        </summary>
        <p className="mt-2 text-xs text-slate-600">
          Clasificación por tabla GNDVI/CIre con transición graduada alrededor de cada umbral para evitar cortes bruscos.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["gndviHighMin", "GNDVI: umbral de Alto"],
            ["cireHighMin", "CIre: umbral de Alto"],
            ["gndviTransitionWidth", "GNDVI: ancho transición (graduado)"],
            ["cireTransitionWidth", "CIre: ancho transición (graduado)"],
          ].map(([key, label]) => (
            <label key={key} className="flex flex-col gap-1 rounded border border-slate-200 bg-white p-2">
              <span className="text-[11px] text-slate-600">{label}</span>
              <input
                type="number"
                step={0.001}
                value={maturityUi[key]}
                onChange={(e) => setThresholdValue(key, e.target.value)}
                className="rounded border border-slate-300 px-2 py-1 text-sm text-slate-800"
              />
            </label>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={resetMaturityThresholds}
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100"
          >
            Restaurar valores por defecto
          </button>
        </div>
      </details>

      {loading && (
        <p className="text-sm text-slate-500">
          Cargando cubes multiespectrales…
        </p>
      )}
      {error && !loading && (
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          No se pudieron cargar cubes desde Supabase ({error}). La subida de
          imágenes sigue funcionando.
        </p>
      )}

      {!loading && (
        <div className="grid gap-4 md:grid-cols-[220px,1fr]">
          <aside className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Spectral cubes
            </p>
            {cubes.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">
                Sin cubes. Sube imágenes arriba para comenzar.
              </p>
            ) : (
            <div className="space-y-1">
              {cubes.map((cube) => (
                <div
                  key={cube.id}
                  className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5"
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
                    {cube.bands?.ndvi ? (
                      <span className="mt-0.5 text-[10px] text-emerald-600">
                        NDVI + R / NIR
                      </span>
                    ) : cube.bands?.r &&
                      cube.bands?.g &&
                      cube.bands?.b &&
                      cube.bands?.re &&
                      cube.bands?.nir ? (
                      <span className="mt-0.5 text-[10px] text-emerald-600">
                        5 bandas cargadas
                      </span>
                    ) : cube.bands ? (
                      <span className="mt-0.5 text-[10px] text-amber-700">
                        Banda(s) parcial(es)
                      </span>
                    ) : null}
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
                    className="shrink-0 self-stretch rounded-md border border-red-200 bg-white px-2 py-1 text-[11px] font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    {deletePendingId === cube.id ? "…" : "Borrar"}
                  </button>
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

          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Visualización
                </p>
                <p className="text-sm text-slate-600">
                  Selecciona un índice o canal para aplicar sobre el fruto.
                </p>
              </div>
              <select
                value={selectedVisualization}
                onChange={(e) => setSelectedVisualization(e.target.value)}
                disabled={cubes.length === 0}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm disabled:opacity-50"
              >
                {VISUALIZATIONS.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 md:grid-cols-[minmax(0,2fr),minmax(0,1fr)]">
              <div className="flex min-w-0 flex-col rounded-xl border border-slate-200 bg-slate-950/5 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Vista por imagen
                  </p>
                  <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-medium text-slate-50">
                    {selectedVisualization}
                  </span>
                </div>
                <div className="mt-4 flex min-h-[min(50vh,20rem)] flex-1 items-center justify-center rounded-xl bg-slate-900 p-4 sm:p-6">
                  <SpectralImagePreview
                    visualization={selectedVisualization}
                    bands={statsCube?.bands ?? null}
                    empty={cubes.length === 0}
                    onComputedStats={setComputedIndexStats}
                  />
                </div>
                {cubes.length > 0 && (
                <div className="mt-4 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Escala</span>
                    <div className="h-2 flex-1 rounded-full bg-gradient-to-r from-red-500 via-yellow-300 to-emerald-500" />
                    {COMPUTED_INDEX_KEYS.has(selectedVisualization) &&
                    (selectedVisualization === "CI_re" ||
                      selectedVisualization === "SIPI") ? (
                      <>
                        <span className="text-[11px] text-slate-500">mín</span>
                        <span className="text-[11px] text-slate-500">med</span>
                        <span className="text-[11px] text-slate-500">máx</span>
                      </>
                    ) : (
                      <>
                        <span className="text-[11px] text-slate-500">-1.0</span>
                        <span className="text-[11px] text-slate-500">0.0</span>
                        <span className="text-[11px] text-slate-500">+1.0</span>
                      </>
                    )}
                  </div>
                  {COMPUTED_INDEX_KEYS.has(selectedVisualization) &&
                  (selectedVisualization === "CI_re" ||
                    selectedVisualization === "SIPI") ? (
                    <p className="text-[10px] text-slate-500">
                      Colormap lineal del mínimo al máximo de esta imagen (cada
                      escena).
                    </p>
                  ) : null}
                </div>
                )}
              </div>

              <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Resumen del índice
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {COMPUTED_INDEX_KEYS.has(selectedVisualization)
                      ? "Estadísticas del mapa calculado en el navegador desde las bandas del cube."
                      : statsCube?.bands?.ndvi
                        ? "Estadísticas calculadas en el cliente al generar el NDVI."
                        : "Valores del cube guardado o simulados si no hay NDVI en datos."}
                  </p>
                </div>
                <dl className="space-y-2 text-xs text-slate-600">
                  <div className="flex justify-between">
                    <dt>Media</dt>
                    <dd>
                      {COMPUTED_INDEX_KEYS.has(selectedVisualization) &&
                      computedIndexStats
                        ? computedIndexStats.mean.toFixed(3)
                        : statsCube?.stats?.mean != null
                          ? statsCube.stats.mean.toFixed(2)
                          : "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Mínimo</dt>
                    <dd>
                      {COMPUTED_INDEX_KEYS.has(selectedVisualization) &&
                      computedIndexStats
                        ? computedIndexStats.min.toFixed(3)
                        : statsCube?.stats?.min != null
                          ? statsCube.stats.min.toFixed(2)
                          : "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Máximo</dt>
                    <dd>
                      {COMPUTED_INDEX_KEYS.has(selectedVisualization) &&
                      computedIndexStats
                        ? computedIndexStats.max.toFixed(3)
                        : statsCube?.stats?.max != null
                          ? statsCube.stats.max.toFixed(2)
                          : "—"}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
