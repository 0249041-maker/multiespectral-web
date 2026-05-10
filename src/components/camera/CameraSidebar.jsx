import { CAMERA_NAV_GROUPS } from "@/lib/cameraDashboardConstants";

function NavIcon({ id }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-emerald-50 text-emerald-700">
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        {id === "instrument" && (
          <path d="M12 3v3M12 18v3M4.5 12H2M22 12h-2.5M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1M8 12a4 4 0 108 0 4 4 0 00-8 0z" />
        )}
        {id === "config" && (
          <path d="M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
        )}
        {id === "cal" && (
          <>
            <path d="M4 19h16M6 5l2 12h8l2-12" />
            <path d="M9 9h6M8 13h8" />
          </>
        )}
        {id === "cap" && (
          <path d="M4 7h4l2-3h4l2 3h4v12H4V7z M12 17a4 4 0 100-8 4 4 0 000 8z" />
        )}
        {id === "sys" && (
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        )}
      </svg>
    </span>
  );
}

const GROUP_ICON = {
  Instrumentación: "instrument",
  Configuración: "config",
  Calibración: "cal",
  Captura: "cap",
  Sistema: "sys",
};

export default function CameraSidebar({ activeId, onSelect }) {
  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-slate-200 bg-white lg:w-60 lg:border-b-0 lg:border-r xl:w-64">
      <div className="border-b border-slate-200 px-3 py-3 lg:px-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Panel de instrumentación
        </p>
        <p className="mt-1 text-xs text-slate-500">Raspberry Pi 5 · multiespectral</p>
      </div>
      <nav className="flex flex-1 gap-1 overflow-x-auto px-2 py-2 lg:flex-col lg:overflow-y-auto lg:px-2 lg:py-3">
        {CAMERA_NAV_GROUPS.map((group) => (
          <div key={group.label} className="lg:mb-4">
            <p className="hidden px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 lg:block">
              {group.label}
            </p>
            <div className="flex gap-1 lg:flex-col">
              {group.items.map((item) => {
                const active = activeId === item.id;
                const icon = GROUP_ICON[group.label] || "sys";
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelect(item.id)}
                    className={`flex min-w-[9rem] items-center gap-2 rounded-xl px-2 py-2 text-left text-sm transition lg:min-w-0 lg:px-3 ${
                      active
                        ? "bg-emerald-50 text-emerald-950 ring-1 ring-emerald-100"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <NavIcon id={icon} />
                    <span className="min-w-0 flex-1 truncate font-medium">{item.short}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
