import CameraDashboardLayout from "@/components/camera/CameraDashboardLayout.jsx";

/**
 * Pantalla dedicada a control y calibración de la cámara multiespectral (Raspberry Pi).
 * Solo interfaz: la lógica de dispositivo es mock hasta conectar backend.
 *
 * @param {{ onBack?: () => void, embedded?: boolean }} props
 */
export default function CameraControlPage({ onBack, embedded = false }) {
  return (
    <CameraDashboardLayout embedded={embedded} onBack={onBack ?? (() => {})} />
  );
}
