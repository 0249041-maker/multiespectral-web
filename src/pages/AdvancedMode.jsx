import { useSpectralCubes } from "@/state/useSpectralCubes";

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
  "RGB",
  "BLUE",
  "GREEN",
  "RED",
  "RE",
  "NIR",
];

export default function AdvancedMode() {
  const {
    cubes,
    selectedCubeId,
    setSelectedCubeId,
    selectedVisualization,
    setSelectedVisualization,
    loading,
    error,
  } = useSpectralCubes();

  return (
    <section
      aria-label="Modo avanzado multiespectral"
      className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Modo avanzado (técnico)
          </h2>
          <p className="text-sm text-slate-500">
            Visualización detallada de cubes multiespectrales y sus índices.
          </p>
        </div>
      </div>

      {loading && (
        <p className="text-sm text-slate-500">
          Cargando cubes multiespectrales…
        </p>
      )}
      {error && (
        <p className="text-sm text-red-600">
          Ocurrió un error al cargar los cubes: {error}
        </p>
      )}

      {!loading && !error && (
        <div className="grid gap-4 md:grid-cols-[220px,1fr]">
          <aside className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Spectral cubes
            </p>
            <div className="space-y-1">
              {cubes.map((cube) => (
                <button
                  key={cube.id}
                  type="button"
                  onClick={() => setSelectedCubeId(cube.id)}
                  className={`flex w-full flex-col rounded-lg border px-3 py-2 text-left text-xs ${
                    cube.id === selectedCubeId
                      ? "border-emerald-400 bg-emerald-50 text-emerald-900"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:border-emerald-200"
                  }`}
                >
                  <span className="font-semibold">{cube.label}</span>
                  <span className="text-[11px] text-slate-500">
                    {cube.timestampLabel}
                  </span>
                </button>
              ))}
            </div>
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
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm"
              >
                {VISUALIZATIONS.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 md:grid-cols-[minmax(0,2fr),minmax(0,1fr)]">
              <div className="flex flex-col rounded-xl border border-slate-200 bg-slate-950/5 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Vista por imagen
                  </p>
                  <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-medium text-slate-50">
                    {selectedVisualization}
                  </span>
                </div>
                <div className="mt-4 flex flex-1 items-center justify-center rounded-xl bg-slate-900 p-6">
                  <div className="h-56 w-56 rounded-full bg-gradient-to-tr from-slate-700 via-slate-100 to-slate-800" />
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <span className="text-xs text-slate-500">Escala</span>
                  <div className="h-2 flex-1 rounded-full bg-gradient-to-r from-red-500 via-yellow-300 to-emerald-500" />
                  <span className="text-[11px] text-slate-500">-1.0</span>
                  <span className="text-[11px] text-slate-500">0.0</span>
                  <span className="text-[11px] text-slate-500">+1.0</span>
                </div>
              </div>

              <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Resumen del índice
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Valores simulados para vista preliminar de diseño.
                  </p>
                </div>
                <dl className="space-y-2 text-xs text-slate-600">
                  <div className="flex justify-between">
                    <dt>Media</dt>
                    <dd>{cubes[0]?.stats.mean.toFixed(2) ?? "0.00"}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Mínimo</dt>
                    <dd>{cubes[0]?.stats.min.toFixed(2) ?? "-1.00"}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Máximo</dt>
                    <dd>{cubes[0]?.stats.max.toFixed(2) ?? "1.00"}</dd>
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

