import { createContext, useCallback, useContext, useMemo, useState } from "react";

const StrawberryDetectionContext = createContext(null);

export function StrawberryDetectionProvider({ children }) {
  const [fruitCount, setFruitCount] = useState(null);
  const [lastError, setLastError] = useState(null);
  const [lastRunAt, setLastRunAt] = useState(null);

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

  const value = useMemo(
    () => ({
      fruitCount,
      lastError,
      lastRunAt,
      setDetectionResult,
    }),
    [fruitCount, lastError, lastRunAt, setDetectionResult]
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
