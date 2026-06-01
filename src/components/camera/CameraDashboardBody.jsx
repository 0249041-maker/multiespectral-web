import CameraInstrumentHeader from "@/components/camera/CameraInstrumentHeader.jsx";
import CameraSectionPanels from "@/components/camera/CameraSectionPanels.jsx";
import CameraSidebar from "@/components/camera/CameraSidebar.jsx";
import ShutdownModal from "@/components/camera/ShutdownModal.jsx";
import { useCameraShutdown } from "@/hooks/useCameraShutdown";

/**
 * Contenido del panel cámara (dentro de CameraWebSocketProvider).
 */
export default function CameraDashboardBody({ dash }) {
  const shutdown = useCameraShutdown({
    appendLog: dash.appendLog,
    setOnline: dash.setOnline,
    setGlobalStatusKey: dash.setGlobalStatusKey,
  });

  return (
    <>
      <CameraInstrumentHeader shutdown={shutdown} />

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <CameraSidebar
          activeId={dash.section}
          onSelect={dash.setSection}
          workflowStatus={dash.workflowStatus}
        />
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-slate-50">
          <div className="mx-auto max-w-7xl px-4 py-5 md:px-6 lg:py-6">
            <CameraSectionPanels section={dash.section} dash={dash} />
          </div>
        </div>
      </div>

      <ShutdownModal
        open={shutdown.modalOpen}
        phase={shutdown.phase}
        statusMessage={shutdown.statusMessage}
        errorDetail={shutdown.errorDetail}
        onCancel={shutdown.closeModal}
        onConfirm={shutdown.confirmShutdown}
        confirmDisabled={!shutdown.canShutdown}
      />
    </>
  );
}
