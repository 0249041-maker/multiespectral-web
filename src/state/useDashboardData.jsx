import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

function buildMockFromSupabaseLikeData() {
  return {
    avgMaturationDays: 14.8,
    todayPrediction: {
      fruits: 925,
      percentage: 95,
    },
    tomorrowPrediction: {
      fruits: 850,
      percentage: 80,
    },
    todayWorkers: 15,
    tomorrowWorkers: 14,
    ndviAverage: 0.95,
    ndviStatus: "Bueno",
    recommendationTitle: "El clima es favorable para cosecha hoy.",
    recommendationItems: [
      "Se recomienda comenzar la recolección en la mañana.",
      "Priorizar árboles con mayor maduración estimada.",
      "Planificar cuadrillas según número de frutos maduros.",
    ],
  };
}

async function loadFromSupabase() {
  if (!supabase) {
    return buildMockFromSupabaseLikeData();
  }

  // 1) Leemos todos los conteos de frutos.
  const { data: fruitCounts, error } = await supabase
    .from("fruit_counts")
    .select("ripe_fruits, medium_fruits, unripe_fruits");

  if (error) {
    throw error;
  }

  if (!fruitCounts || fruitCounts.length === 0) {
    return buildMockFromSupabaseLikeData();
  }

  const totals = fruitCounts.reduce(
    (acc, row) => {
      acc.ripe += row.ripe_fruits ?? 0;
      acc.medium += row.medium_fruits ?? 0;
      acc.unripe += row.unripe_fruits ?? 0;
      return acc;
    },
    { ripe: 0, medium: 0, unripe: 0 }
  );

  const totalFruits = totals.ripe + totals.medium + totals.unripe || 1;

  const todayRipe = totals.ripe;
  const tomorrowRipe = totals.ripe + Math.round(totals.medium * 0.5);

  const todayPercentage = Math.round((todayRipe / totalFruits) * 100);
  const tomorrowPercentage = Math.round((tomorrowRipe / totalFruits) * 100);

  const todayWorkers = Math.max(1, Math.round(todayRipe / 60));
  const tomorrowWorkers = Math.max(1, Math.round(tomorrowRipe / 60));

  return {
    avgMaturationDays: 14.8,
    todayPrediction: {
      fruits: todayRipe,
      percentage: todayPercentage,
    },
    tomorrowPrediction: {
      fruits: tomorrowRipe,
      percentage: tomorrowPercentage,
    },
    todayWorkers,
    tomorrowWorkers,
    ndviAverage: 0.95,
    ndviStatus: "Bueno",
    recommendationTitle: "Plan de cosecha basado en datos reales.",
    recommendationItems: [
      "Asignar cuadrillas según frutos maduros estimados.",
      "Revisar bloques con mayor porcentaje de madurez.",
      "Ajustar personal para mañana según proyección.",
    ],
  };
}

export function useDashboardData() {
  const [state, setState] = useState({
    loading: true,
    error: null,
    data: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await loadFromSupabase();
        if (!cancelled) {
          setState({ loading: false, error: null, data });
        }
      } catch (e) {
        if (!cancelled) {
          setState({
            loading: false,
            error: e instanceof Error ? e.message : "Error desconocido",
            data: null,
          });
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

