import CameraLiveFlow from "@/components/CameraLiveFlow.jsx";

/**
 * Pantalla dedicada a control y vista en vivo de la cámara (flujo + WebSocket).
 */
export default function CameraControlPage({ onBack }) {
  return <CameraLiveFlow onBack={onBack} />;
}
