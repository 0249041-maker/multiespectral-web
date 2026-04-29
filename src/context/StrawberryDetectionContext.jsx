import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const StrawberryDetectionContext = createContext(null);

export function StrawberryDetectionProvider({ children }) {
  const [fruitCount, setFruitCount] = useState(null);
  const [lastError, setLastError] = useState(null);
  const [lastRunAt, setLastRunAt] = useState(null);
  /** URLs del cube seleccionado (modo avanzado) para índices por bbox. */
  const [spectralCubeBands, setSpectralCubeBands] = useState(null);
  /** Cube activo en modo avanzado (para enlazar métricas del dashboard). */
  const [spectralCubeSelection, setSpectralCubeSelection] = useState({
    id: null,
    label: null,
  });
  /** NDVI del cube seleccionado (si existe en stats del cube). */
  const [selectedCubeNdviStats, setSelectedCubeNdviStats] = useState(null);
  /** Cube con el que se ejecutó la última detección válida (madurez acoplada). */
  const [lastDetectionCubeId, setLastDetectionCubeId] = useState(null);
  /** Última salida de YOLO + madurez (si se pudo calcular). */
  const [fruitBoxes, setFruitBoxes] = useState(null);
  /** RGB compuesto multiespectral (modo avanzado) para inferencia YOLO. */
  const [spectralRgbBitmap, setSpectralRgbBitmapState] = useState(null);
  /** Blob del RGB compuesto para reconstruir bitmap si hace falta. */
  const [spectralRgbBlob, setSpectralRgbBlob] = useState(null);

  const setDetectionResult = useCallback((count, err = null, extras = null) => {
    if (err != null && err !== "") {
      setFruitCount(null);
      setFruitBoxes(null);
      setLastDetectionCubeId(null);
      setLastError(typeof err === "string" ? err : err?.message ?? String(err));
    } else {
      setFruitCount(typeof count === "number" ? count : null);
      setLastError(null);
      const boxes = extras?.boxes;
      setFruitBoxes(Array.isArray(boxes) ? boxes : null);
      const cid = extras?.cubeId;
      setLastDetectionCubeId(typeof cid === "string" && cid ? cid : null);
    }
    setLastRunAt(new Date().toISOString());
  }, []);

  const setSpectralRgbBitmap = useCallback((next) => {
    setSpectralRgbBitmapState((prev) => {
      if (prev) prev.close();
      return next;
    });
  }, []);

  useEffect(
    () => () => {
      setSpectralRgbBitmapState((prev) => {
        if (prev) prev.close();
        return null;
      });
    },
    []
  );

  const value = useMemo(
    () => ({
      fruitCount,
      fruitBoxes,
      lastError,
      lastRunAt,
      setDetectionResult,
      spectralCubeBands,
      setSpectralCubeBands,
      spectralCubeSelection,
      setSpectralCubeSelection,
      selectedCubeNdviStats,
      setSelectedCubeNdviStats,
      lastDetectionCubeId,
      spectralRgbBitmap,
      spectralRgbBlob,
      setSpectralRgbBitmap,
      setSpectralRgbBlob,
    }),
    [
      fruitCount,
      fruitBoxes,
      lastError,
      lastRunAt,
      setDetectionResult,
      spectralCubeBands,
      setSpectralCubeBands,
      spectralCubeSelection,
      setSpectralCubeSelection,
      selectedCubeNdviStats,
      setSelectedCubeNdviStats,
      lastDetectionCubeId,
      spectralRgbBitmap,
      spectralRgbBlob,
      setSpectralRgbBitmap,
      setSpectralRgbBlob,
    ]
  );

  return (
    <StrawberryDetectionContext.Provider value={value}>
      {children}
    </StrawberryDetectionContext.Provider>
  );
}

export function useStrawberryDetection() {
  const ctx = useContext(StrawberryDetectionContext);
  if (!ctx) {
    throw new Error("useStrawberryDetection debe usarse dentro de StrawberryDetectionProvider");
  }
  return ctx;
}
