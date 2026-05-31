import BrowserTabBar from "./components/BrowserTabBar.jsx";
import SupabaseEnvBanner from "./components/SupabaseEnvBanner.jsx";
import { CameraDashboardProvider } from "./context/CameraDashboardContext.jsx";
import { StrawberryDetectionProvider } from "./context/StrawberryDetectionContext.jsx";
import CameraControlPage from "./pages/CameraControlPage.jsx";
import DashboardBasic from "./pages/DashboardBasic.jsx";
import AdvancedMode from "./pages/AdvancedMode.jsx";
import { useState } from "react";

function App() {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeTab, setActiveTab] = useState("home");

  return (
    <StrawberryDetectionProvider>
      <CameraDashboardProvider>
      <div className="flex min-h-screen flex-col bg-slate-50">
        <SupabaseEnvBanner />
        <header className="w-full bg-white">
          <div className="flex w-full items-center justify-between gap-4 border-b border-slate-200 px-4 py-3 md:px-6">
            <div className="flex items-center gap-2 text-left">
              <div className="h-8 w-8 shrink-0 rounded-xl bg-emerald-500" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Plataforma web
                </p>
                <h1 className="text-lg font-semibold text-slate-900">
                  Multiespectral
                </h1>
              </div>
            </div>
            <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              Estado: Draft · v1.0
            </span>
          </div>

          <BrowserTabBar activeId={activeTab} onChange={setActiveTab} />
        </header>

        {activeTab === "home" ? (
          <main
            id="panel-home"
            role="tabpanel"
            aria-labelledby="tab-home"
            className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6 md:px-6"
          >
            <DashboardBasic
              onToggleAdvanced={() => setShowAdvanced((prev) => !prev)}
              advancedVisible={showAdvanced}
            />
            <AdvancedMode uiVisible={showAdvanced} />
          </main>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <CameraControlPage embedded />
          </div>
        )}
      </div>
      </CameraDashboardProvider>
    </StrawberryDetectionProvider>
  );
}

export default App;
