import { createContext, useContext } from "react";
import { useCameraDashboardMocks } from "@/state/useCameraDashboardMocks";

const CameraDashboardContext = createContext(
  /** @type {ReturnType<typeof useCameraDashboardMocks> | null} */ (null)
);

/**
 * Mantiene calibraciones, referencia blanca y sección del panel aunque el usuario
 * cambie entre pestañas Home y Cámara.
 */
export function CameraDashboardProvider({ children }) {
  const dash = useCameraDashboardMocks();
  return (
    <CameraDashboardContext.Provider value={dash}>
      {children}
    </CameraDashboardContext.Provider>
  );
}

export function useCameraDashboard() {
  const ctx = useContext(CameraDashboardContext);
  if (!ctx) {
    throw new Error(
      "useCameraDashboard debe usarse dentro de CameraDashboardProvider"
    );
  }
  return ctx;
}
