import { useMemo, useState } from "react";
import InfoTooltip from "@/components/InfoTooltip";
import { useStrawberryDetection } from "@/context/StrawberryDetectionContext";
import { useLeafNdvi } from "@/hooks/useLeafNdvi";

const WEEKDAYS_ES = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

/** Días desde +1 hasta +5 con etiquetas: Mañana, Pasado, y luego día de la semana. */
function buildDayOptions() {
  const today = new Date();
  const options = [];
  for (let d = 1; d <= 5; d += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() + d);
    let label;
    if (d === 1) label = "Mañana";
    else if (d === 2) label = "Pasado";
    else label = WEEKDAYS_ES[date.getDay()];
    options.push({ offset: d, label });
  }
  return options;
}

function countByMaturity(fruitBoxes) {
  const acc = { inmadura: 0, madura: 0, sobremadura: 0 };
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

/** Regla simple: 85% de inmaduros maduran en 3 días (lineal hasta el día 3). */
function projectedRipeForDay({ inmaduros, maduros, offset }) {
  const fraction = Math.min(1, offset / 3) * 0.85;
  return Math.round(maduros + inmaduros * fraction);
}

function MaturityCountCard({ title, value, hasData, info }) {
  return (
    <div className="relative rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-lg font-semibold uppercase tracking-wide text-slate-800">
          {title}
        </p>
        {info ? <InfoTooltip label={`Más información ${title}`}>{info}</InfoTooltip> : null}
      </div>
      <p className="mt-4 text-3xl font-semibold text-slate-900">
        {hasData ? value : "—"}
      </p>
    </div>
  );
}

function StatCard({ title, value, hasData, info, footer }) {
  return (
    <div className="relative rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {title}
        </p>
        {info ? <InfoTooltip label={`Más información ${title}`}>{info}</InfoTooltip> : null}
      </div>
      <p className="mt-3 text-2xl font-semibold text-slate-900">
        {hasData ? value : "—"}
      </p>
      {footer}
    </div>
  );
}

function DaySelector({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number.parseInt(e.target.value, 10))}
      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
    >
      {options.map((o) => (
        <option key={o.offset} value={o.offset}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export default function DashboardBasic({ onToggleAdvanced, advancedVisible }) {
  const {
    fruitCount,
    fruitBoxes,
    lastRunAt,
    spectralCubeSelection,
    spectralCubeBands,
    spectralCubeCompensators,
    lastDetectionCubeId,
    lastDetectionImageSize,
  } = useStrawberryDetection();

  const selectedId = spectralCubeSelection?.id ?? null;
  const selectedLabel = spectralCubeSelection?.label ?? null;

  const detectionMatchesCube = Boolean(
    selectedId && lastDetectionCubeId && lastDetectionCubeId === selectedId
  );
  const hasBoxes = Array.isArray(fruitBoxes) && fruitBoxes.length > 0;
  const hasMaturity = hasBoxes && fruitBoxes.some((b) => Boolean(b.maturity));

  // Datos visibles solo si la detección y madurez corresponden al cube seleccionado.
  const dataReady = detectionMatchesCube && hasMaturity;
  const maturityCounts = dataReady ? countByMaturity(fruitBoxes) : null;

  const cubeInmaduros = maturityCounts?.inmadura ?? 0;
  const cubeMaduros = maturityCounts?.madura ?? 0;
  const cubeSobremaduros = maturityCounts?.sobremadura ?? 0;

  const dayOptions = useMemo(() => buildDayOptions(), []);
  const [predOffset, setPredOffset] = useState(dayOptions[0]?.offset ?? 1);
  const [workersOffset, setWorkersOffset] = useState(dayOptions[0]?.offset ?? 1);

  const projectedRipe = dataReady
    ? projectedRipeForDay({
        inmaduros: cubeInmaduros,
        maduros: cubeMaduros,
        offset: predOffset,
      })
    : null;

  const projectedRipeForWorkers = dataReady
    ? projectedRipeForDay({
        inmaduros: cubeInmaduros,
        maduros: cubeMaduros,
        offset: workersOffset,
      })
    : null;

  const personsTodayRule = dataReady
    ? Math.max(1, Math.ceil(cubeMaduros / 60))
    : null;
  const personsForFutureDay =
    projectedRipeForWorkers != null
      ? Math.max(1, Math.ceil(projectedRipeForWorkers / 60))
      : null;

  // NDVI promedio de hojas (excluyendo cajas de fruto) sobre el cube seleccionado.
  const leaf = useLeafNdvi({
    cubeId: selectedId,
    bands: spectralCubeBands,
    boxes: fruitBoxes,
    imageWidth: lastDetectionImageSize?.width ?? null,
    imageHeight: lastDetectionImageSize?.height ?? null,
    compensators: spectralCubeCompensators,
  });

  const leafNdviMean = leaf.mean;
  const leafNdviStatus =
    leafNdviMean == null
      ? "—"
      : leafNdviMean >= 0.6
        ? "Bueno"
        : leafNdviMean >= 0.35
          ? "Moderado"
          : "Bajo";

  const cubeText = selectedLabel ? `Cube: ${selectedLabel}` : "Cube: —";

  // Frutos detectados que se muestra junto al cube: solo cuando la detección
  // proviene de yolo sobre el cube seleccionado.
  const detectionLabel =
    detectionMatchesCube && typeof fruitCount === "number"
      ? `Frutos detectados: ${fruitCount}`
      : "Frutos detectados: —";

  return (
    <section aria-label="Dashboard básico" className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900">Modo básico</h2>
        <button
          type="button"
          onClick={onToggleAdvanced}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-800 shadow-sm hover:border-emerald-300 hover:bg-emerald-50"
        >
          {advancedVisible ? "Ocultar modo avanzado" : "Ver modo avanzado"}
        </button>
      </div>

      <div className="rounded-xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/90 to-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-emerald-900">{cubeText}</p>
          <p className="text-sm font-medium text-emerald-900">{detectionLabel}</p>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MaturityCountCard
            title="Inmaduras"
            value={`${cubeInmaduros} fresas`}
            hasData={dataReady}
            info={
              <>
                Frutos clasificados como <strong>inmaduros</strong> según los
                índices espectrales (GNDVI, CIre, SIPI, VARI) dentro de cada
                caja de detección.
              </>
            }
          />
          <MaturityCountCard
            title="Maduras"
            value={`${cubeMaduros} fresas`}
            hasData={dataReady}
            info={
              <>
                Frutos clasificados como <strong>maduros</strong> y listos para
                consumo a partir de los índices espectrales del cube
                seleccionado.
              </>
            }
          />
          <MaturityCountCard
            title="Sobremaduras"
            value={`${cubeSobremaduros} fresas`}
            hasData={dataReady}
            info={
              <>
                Frutos clasificados como <strong>sobremaduros</strong> (pasados
                de punto) según los umbrales de madurez del cube seleccionado.
              </>
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Predicción de maduración · Hoy"
          value={dataReady ? `${cubeMaduros} frutos` : "—"}
          hasData={dataReady}
          info={
            <>
              Cantidad de frutos clasificados como <strong>maduros</strong> en
              la última detección del cube seleccionado.
            </>
          }
        />

        <StatCard
          title="Predicción de maduración"
          value={dataReady ? `${projectedRipe} frutos` : "—"}
          hasData={dataReady}
          info={
            <>
              Estimación basada en una regla sencilla: el 85% de los frutos
              inmaduros madura en 3 días (lineal hasta el día 3). Se añade a los
              frutos actualmente maduros del cube.
            </>
          }
          footer={
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="text-[11px] uppercase tracking-wide text-slate-500">
                Día
              </span>
              <DaySelector
                value={predOffset}
                onChange={setPredOffset}
                options={dayOptions}
              />
            </div>
          }
        />

        <StatCard
          title="Personas para recolectar · Hoy"
          value={dataReady ? `${personsTodayRule} personas` : "—"}
          hasData={dataReady}
          info={
            <>
              Estimación: <strong>1 persona por cada 60 frutos maduros</strong>{" "}
              hoy (mínimo 1). Es una heurística simple a partir del recuento del
              cube.
            </>
          }
        />

        <StatCard
          title="Personas para recolectar"
          value={
            personsForFutureDay != null ? `${personsForFutureDay} personas` : "—"
          }
          hasData={dataReady}
          info={
            <>
              Se calcula a partir de la <strong>proyección de frutos maduros</strong>{" "}
              para el día elegido (regla del 85% de inmaduros en 3 días) y la
              relación 1 persona por cada 60 frutos.
            </>
          }
          footer={
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="text-[11px] uppercase tracking-wide text-slate-500">
                Día
              </span>
              <DaySelector
                value={workersOffset}
                onChange={setWorkersOffset}
                options={dayOptions}
              />
            </div>
          }
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-semibold uppercase tracking-wide text-slate-800">
              Salud general
            </p>
            <p className="mt-1 text-sm text-slate-500">Basado en promedio NDVI</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              {leafNdviStatus}
            </span>
            <InfoTooltip label="Más información salud general">
              <>
                NDVI promedio calculado sobre los <strong>píxeles de hojas</strong>{" "}
                (excluyendo cajas de fruto detectadas por YOLO) del cube
                seleccionado. Un NDVI más alto indica vegetación más vigorosa.
              </>
            </InfoTooltip>
          </div>
        </div>
        <div className="mt-4 flex items-end justify-between gap-3">
          <p className="text-3xl font-semibold text-slate-900">
            {leaf.loading
              ? "…"
              : leafNdviMean != null
                ? leafNdviMean.toFixed(2)
                : "—"}
          </p>
          <div className="h-2 flex-1 rounded-full bg-gradient-to-r from-red-400 via-yellow-300 to-emerald-500" />
        </div>
        {leaf.error ? (
          <p className="mt-2 text-xs text-red-600">{leaf.error}</p>
        ) : null}
      </div>
    </section>
  );
}
