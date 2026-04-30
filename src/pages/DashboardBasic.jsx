import { useStrawberryDetection } from "@/context/StrawberryDetectionContext";
import { getMaturityThresholds } from "@/lib/strawberryMaturity";
import { useDashboardData } from "@/state/useDashboardData";

function StatCard({ title, subtitle, value, detail }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </p>
      <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      <p className="mt-3 text-2xl font-semibold text-slate-900">{value}</p>
      {detail != null && detail !== false && (
        <p className="mt-1 text-xs text-slate-500">{detail}</p>
      )}
    </div>
  );
}

function countByMaturity(fruitBoxes) {
  const acc = {
    inmadura: 0,
    madura: 0,
    sobremadura: 0,
  };
  for (const b of fruitBoxes) {
    const k = b.maturity;
    if (!k) continue;
    if (k === "media") {
      acc.madura += 1;
      continue;
    }
    if (acc[k] != null) acc[k] += 1;
  }
  return acc;
}

/** Inmaduros con mayoría roja en VARI (redCoverage) pero clase ≠ madura: casi listos. */
function countAlmostRipeNotYetMadura(fruitBoxes) {
  const minRed = getMaturityThresholds().redCoverageForMaduraMin;
  let n = 0;
  for (const b of fruitBoxes) {
    if (b.maturity !== "inmadura") continue;
    const rc = b.indices?.redCoverage;
    if (typeof rc === "number" && Number.isFinite(rc) && rc >= minRed) {
      n += 1;
    }
  }
  return n;
}

export default function DashboardBasic({ onToggleAdvanced, advancedVisible }) {
  const { data, loading, error, warning } = useDashboardData();
  const {
    fruitCount,
    fruitBoxes,
    lastError,
    lastRunAt,
    spectralCubeSelection,
    selectedCubeNdviStats,
    lastDetectionCubeId,
  } = useStrawberryDetection();

  const todayLabel = new Date().toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const selectedId = spectralCubeSelection?.id ?? null;
  const selectedLabel = spectralCubeSelection?.label ?? null;
  const detectionMatchesCube = Boolean(
    selectedId &&
      lastDetectionCubeId &&
      lastDetectionCubeId === selectedId
  );
  const hasBoxes = Array.isArray(fruitBoxes) && fruitBoxes.length > 0;
  const hasMaturity =
    hasBoxes && fruitBoxes.some((b) => Boolean(b.maturity));
  const maturityCounts =
    detectionMatchesCube && hasMaturity ? countByMaturity(fruitBoxes) : null;
  const showZeros = detectionMatchesCube && hasBoxes && !hasMaturity;
  const useCubeHarvestCards =
    Boolean(detectionMatchesCube && hasMaturity && maturityCounts);
  const cubeMaduros = useCubeHarvestCards ? maturityCounts.madura : null;
  const cubePorMadurar = useCubeHarvestCards
    ? countAlmostRipeNotYetMadura(fruitBoxes)
    : null;
  const personsToday01 =
    useCubeHarvestCards && cubeMaduros != null
      ? cubeMaduros > 0
        ? 1
        : 0
      : null;
  const personsTomorrow01 =
    useCubeHarvestCards && cubePorMadurar != null
      ? cubePorMadurar > 0
        ? 1
        : 0
      : null;

  let maturityRowHint = null;
  if (!selectedId) {
    maturityRowHint =
      "Abre «Ver modo avanzado» y selecciona un cube en la lista lateral.";
  } else if (!lastRunAt) {
    maturityRowHint =
      "Pulsa «Detectar frutos» abajo usando el RGB del cube seleccionado.";
  } else if (!detectionMatchesCube) {
    maturityRowHint =
      "La última detección no corresponde a este cube; vuelve a ejecutar detección con el cube actual.";
  } else if (!hasMaturity && hasBoxes) {
    maturityRowHint =
      "Hay frutos detectados pero sin madurez espectral: el cube necesita las 5 bandas (R,G,B,RE,NIR).";
  } else if (detectionMatchesCube && !hasBoxes) {
    maturityRowHint =
      "Última ejecución con este cube: 0 frutos detectados.";
  }

  const formatMaturityCell = (key) => {
    if (maturityCounts) return `${maturityCounts[key]} fresas`;
    if (showZeros) return "0 fresas";
    return "—";
  };

  if (loading) {
    return (
      <section aria-label="Dashboard básico">
        <p className="text-sm text-slate-500">Cargando indicadores…</p>
      </section>
    );
  }

  if (error && !data) {
    return (
      <section aria-label="Dashboard básico">
        <p className="text-sm text-red-600">
          Ocurrió un error al cargar los datos: {error}
        </p>
      </section>
    );
  }

  if (!data) {
    return (
      <section aria-label="Dashboard básico">
        <p className="text-sm text-red-600">
          No hay datos para mostrar. Revisa la consola o la conexión.
        </p>
      </section>
    );
  }

  const {
    avgMaturationDays,
    todayPrediction,
    tomorrowPrediction,
    todayWorkers,
    tomorrowWorkers,
    ndviAverage,
    ndviStatus,
  } = data;

  const currentNdviMean = selectedCubeNdviStats?.mean ?? ndviAverage;
  const currentNdviStatus =
    selectedCubeNdviStats?.mean != null
      ? selectedCubeNdviStats.mean >= 0.6
        ? "Bueno"
        : selectedCubeNdviStats.mean >= 0.35
          ? "Moderado"
          : "Bajo"
      : ndviStatus;
  const ndviSourceLabel = selectedCubeNdviStats
    ? selectedLabel
      ? `NDVI calculado del cube ${selectedLabel}.`
      : "NDVI calculado del cube seleccionado."
    : "NDVI general (sin cube seleccionado con stats NDVI).";

  return (
    <section aria-label="Dashboard básico" className="space-y-4">
      {warning && (
        <div
          role="status"
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
        >
          <p className="font-medium text-amber-900">Aviso</p>
          <p className="mt-1 text-amber-800">{warning}</p>
          <p className="mt-2 text-xs text-amber-800/90">
            Para datos reales, crea la tabla{" "}
            <code className="rounded bg-amber-100 px-1">fruit_counts</code> en
            Supabase y políticas de lectura para{" "}
            <code className="rounded bg-amber-100 px-1">anon</code>, o revisa
            URL/clave en Vercel.
          </p>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Modo básico (agricultor)
          </h2>
          <p className="text-sm text-slate-500">
            Resumen de maduración y cosecha a partir de datos multiespectrales.
          </p>
        </div>
        <button
          type="button"
          onClick={onToggleAdvanced}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-800 shadow-sm hover:border-emerald-300 hover:bg-emerald-50"
        >
          {advancedVisible ? "Ocultar modo avanzado" : "Ver modo avanzado"}
        </button>
      </div>

      <div className="rounded-xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/90 to-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
          Hoy · fresas por madurez (cube seleccionado)
        </p>
        <p className="mt-1 text-sm text-slate-600">
          <span className="capitalize">{todayLabel}</span>
          {selectedLabel ? (
            <>
              {" "}
              · Cube:{" "}
              <span className="font-medium text-slate-800">{selectedLabel}</span>
            </>
          ) : (
            <span className="text-amber-800"> · Sin cube seleccionado aún</span>
          )}
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard
            title="Inmaduras"
            subtitle="Verdes / poca maduración"
            value={formatMaturityCell("inmadura")}
            detail={false}
          />
          <StatCard
            title="Maduras"
            subtitle="Listas para consumo óptimo"
            value={formatMaturityCell("madura")}
            detail={false}
          />
          <StatCard
            title="Sobremaduras"
            subtitle="Pasadas de punto"
            value={formatMaturityCell("sobremadura")}
            detail={false}
          />
        </div>
        {maturityRowHint ? (
          <p className="mt-3 text-xs text-slate-600">{maturityRowHint}</p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          title="Frutos detectados (YOLO)"
          subtitle="RGB multiespectral (modo avanzado) o imagen subida"
          value={fruitCount != null ? `${fruitCount} frutos` : "—"}
          detail={
            lastError ? (
              <span className="text-red-600">{lastError}</span>
            ) : lastRunAt ? (
              `Última prueba: ${new Date(lastRunAt).toLocaleString("es-ES")}`
            ) : (
              "Sin pruebas aún (panel de detección abajo)."
            )
          }
        />
        <StatCard
          title="Tiempo promedio de maduración"
          subtitle="Días por fruto"
          value={`${avgMaturationDays.toFixed(1)} días`}
        />
        <StatCard
          title="Predicción de maduración"
          subtitle="Hoy"
          value={
            cubeMaduros != null
              ? `${cubeMaduros} frutos`
              : `${todayPrediction.fruits} frutos`
          }
          detail={
            cubeMaduros != null
              ? "Frutos clasificados como maduros (cube seleccionado)."
              : `${todayPrediction.percentage}% del total estimado`
          }
        />
        <StatCard
          title="Predicción de maduración"
          subtitle="Mañana"
          value={
            cubePorMadurar != null
              ? `${cubePorMadurar} frutos`
              : `${tomorrowPrediction.fruits} frutos`
          }
          detail={
            cubePorMadurar != null
              ? "Inmaduros con mayoría roja en VARI, aún no maduros."
              : `${tomorrowPrediction.percentage}% del total estimado`
          }
        />
        <StatCard
          title="Personas para recolectar"
          subtitle="Hoy"
          value={
            personsToday01 != null
              ? String(personsToday01)
              : `${todayWorkers} personas`
          }
          detail={
            personsToday01 != null
              ? personsToday01 === 1
                ? "Hay frutos maduros en el cube (indicador 1/0)."
                : "Sin frutos maduros en el cube (indicador 1/0)."
              : false
          }
        />
        <StatCard
          title="Personas para recolectar"
          subtitle="Mañana"
          value={
            personsTomorrow01 != null
              ? String(personsTomorrow01)
              : `${tomorrowWorkers} personas`
          }
          detail={
            personsTomorrow01 != null
              ? personsTomorrow01 === 1
                ? "Hay frutos por madurar pronto (indicador 1/0)."
                : "Sin frutos en ese umbral (indicador 1/0)."
              : false
          }
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Salud general del cultivo
            </p>
            <p className="mt-1 text-sm text-slate-500">Basado en promedio NDVI</p>
          </div>
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            {currentNdviStatus}
          </span>
        </div>
        <div className="mt-4 flex items-end justify-between">
          <div>
            <p className="text-xs text-slate-500">NDVI promedio</p>
            <p className="text-2xl font-semibold text-slate-900">
              {currentNdviMean.toFixed(2)}
            </p>
          </div>
          <div className="h-2 flex-1 rounded-full bg-gradient-to-r from-red-400 via-yellow-300 to-emerald-500" />
        </div>
        <p className="mt-3 text-xs text-slate-500">{ndviSourceLabel}</p>
      </div>
    </section>
  );
}

