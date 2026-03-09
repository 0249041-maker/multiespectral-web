import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const MOCK_CUBES = [
  {
    id: "cube-1",
    label: "Cube 1",
    timestampLabel: "Hoy · 10:23 AM",
    stats: { mean: 0.61, min: -0.95, max: 0.99 },
  },
  {
    id: "cube-2",
    label: "Cube 2",
    timestampLabel: "Hoy · 11:05 AM",
    stats: { mean: 0.54, min: -0.88, max: 0.97 },
  },
  {
    id: "cube-3",
    label: "Cube 3",
    timestampLabel: "Ayer · 16:42 PM",
    stats: { mean: 0.48, min: -0.90, max: 0.96 },
  },
];

async function loadCubesFromSupabase() {
  if (!supabase) {
    return MOCK_CUBES;
  }

  const { data: captures, error } = await supabase
    .from("captures")
    .select("id, timestamp")
    .order("timestamp", { ascending: false })
    .limit(3);

  if (error) {
    throw error;
  }

  if (!captures || captures.length === 0) {
    return MOCK_CUBES;
  }

  return captures.map((capture, index) => {
    const ts = capture.timestamp
      ? new Date(capture.timestamp)
      : new Date();
    const formatter = new Intl.DateTimeFormat("es-ES", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

    return {
      id: capture.id,
      label: `Cube ${index + 1}`,
      timestampLabel: formatter.format(ts),
      stats: { mean: 0.6, min: -0.95, max: 0.99 },
    };
  });
}

export function useSpectralCubes() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cubes, setCubes] = useState([]);
  const [selectedCubeId, setSelectedCubeId] = useState("cube-1");
  const [selectedVisualization, setSelectedVisualization] = useState("NDVI");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const list = await loadCubesFromSupabase();
        if (!cancelled) {
          setCubes(list);
          setSelectedCubeId(list[0]?.id ?? "cube-1");
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "No se pudieron cargar los cubes"
          );
          setCubes(MOCK_CUBES);
          setSelectedCubeId("cube-1");
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    cubes,
    selectedCubeId,
    setSelectedCubeId,
    selectedVisualization,
    setSelectedVisualization,
    loading,
    error,
  };
}

