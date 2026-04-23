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
  /** RGB compuesto multiespectral (modo avanzado) para inferencia YOLO. */
  const [spectralRgbBitmap, setSpectralRgbBitmapState] = useState(null);

  const setDetectionResult = useCallback((count, err = null) => {
    if (err != null && err !== "") {
      setFruitCount(null);
      setLastError(typeof err === "string" ? err : err?.message ?? String(err));
    } else {
      setFruitCount(typeof count === "number" ? count : null);
      setLastError(null);
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
      lastError,
      lastRunAt,
      setDetectionResult,
      spectralRgbBitmap,
      setSpectralRgbBitmap,
    }),
    [fruitCount, lastError, lastRunAt, setDetectionResult, spectralRgbBitmap, setSpectralRgbBitmap]
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
