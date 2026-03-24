import DashboardBasic from "./pages/DashboardBasic.jsx";
import AdvancedMode from "./pages/AdvancedMode.jsx";
import { useState } from "react";

function App() {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 md:px-6">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-emerald-500" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Plataforma web
              </p>
              <h1 className="text-lg font-semibold text-slate-900">
                Multiespectral
              </h1>
            </div>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            Estado: Draft · v1.0
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-6 space-y-6 md:px-6">
        <DashboardBasic
          onToggleAdvanced={() => setShowAdvanced((prev) => !prev)}
          advancedVisible={showAdvanced}
        />
        {showAdvanced && <AdvancedMode />}
      </main>
    </div>
  );
}

export default App;
