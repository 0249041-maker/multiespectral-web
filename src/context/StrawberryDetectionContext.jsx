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
  /** Dimensiones (px) del bitmap usado en la última detección. */
  const [lastDetectionImageSize, setLastDetectionImageSize] = useState(null);
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
      setLastDetectionImageSize(null);
      setLastError(typeof err === "string" ? err : err?.message ?? String(err));
    } else {
      setFruitCount(typeof count === "number" ? count : null);
      setLastError(null);
      const boxes = extras?.boxes;
      setFruitBoxes(Array.isArray(boxes) ? boxes : null);
      const cid = extras?.cubeId;
      setLastDetectionCubeId(typeof cid === "string" && cid ? cid : null);
      const w = extras?.imageWidth;
      const h = extras?.imageHeight;
      if (typeof w === "number" && typeof h === "number" && w > 0 && h > 0) {
        setLastDetectionImageSize({ width: w, height: h });
      } else {
        setLastDetectionImageSize(null);
      }
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
      lastDetectionImageSize,
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
      lastDetectionImageSize,
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
