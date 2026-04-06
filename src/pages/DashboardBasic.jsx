import { useStrawberryDetection } from "@/context/StrawberryDetectionContext";
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

function RecommendationCard({ title, items }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Recomendación
      </p>
      <h3 className="mt-2 text-sm font-semibold text-slate-900">{title}</h3>
      <ul className="mt-2 space-y-1 text-xs text-slate-600">
        {items.map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
    </div>
  );
}

export default function DashboardBasic({ onToggleAdvanced, advancedVisible }) {
  const { data, loading, error, warning } = useDashboardData();
  const { fruitCount, lastError, lastRunAt } = useStrawberryDetection();

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
    recommendationTitle,
    recommendationItems,
  } = data;

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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          title="Frutos detectados (YOLO)"
          subtitle="Conteo en imagen RGB"
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
          value={`${todayPrediction.fruits} frutos`}
          detail={`${todayPrediction.percentage}% del total estimado`}
        />
        <StatCard
          title="Predicción de maduración"
          subtitle="Mañana"
          value={`${tomorrowPrediction.fruits} frutos`}
          detail={`${tomorrowPrediction.percentage}% del total estimado`}
        />
        <StatCard
          title="Personas para recolectar"
          subtitle="Hoy"
          value={`${todayWorkers} personas`}
        />
        <StatCard
          title="Personas para recolectar"
          subtitle="Mañana"
          value={`${tomorrowWorkers} personas`}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-4 md:col-span-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Salud general del cultivo
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Basado en promedio NDVI
                </p>
              </div>
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                {ndviStatus}
              </span>
            </div>
            <div className="mt-4 flex items-end justify-between">
              <div>
                <p className="text-xs text-slate-500">NDVI promedio</p>
                <p className="text-2xl font-semibold text-slate-900">
                  {ndviAverage.toFixed(2)}
                </p>
              </div>
              <div className="h-2 flex-1 rounded-full bg-gradient-to-r from-red-400 via-yellow-300 to-emerald-500" />
            </div>
          </div>
          <RecommendationCard
            title={recommendationTitle}
            items={recommendationItems}
          />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Condiciones de recolección
          </p>
          <div className="mt-3 space-y-1 text-sm text-slate-600">
            <p>Clima favorable para cosecha hoy.</p>
            <p>Recomendado iniciar actividades en la mañana.</p>
          </div>
          <dl className="mt-4 space-y-1 text-xs text-slate-500">
            <div className="flex justify-between">
              <dt>Temperatura estimada</dt>
              <dd>27°C</dd>
            </div>
            <div className="flex justify-between">
              <dt>Humedad relativa</dt>
              <dd>72%</dd>
            </div>
            <div className="flex justify-between">
              <dt>Fecha de referencia</dt>
              <dd>Abril 24, 2024</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}

