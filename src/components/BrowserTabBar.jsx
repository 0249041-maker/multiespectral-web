/**
 * Navegación horizontal tipo dashboard (píldora en la opción activa).
 */
const ITEMS = [
  { id: "home", label: "Home" },
  { id: "camera", label: "Cámara" },
];

export default function BrowserTabBar({ activeId, onChange }) {
  return (
    <nav
      className="w-full border-b border-slate-200 bg-white px-4 py-2 md:px-6"
      role="tablist"
      aria-label="Secciones de la aplicación"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-1">
        {ITEMS.map((item) => {
          const active = activeId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`tab-${item.id}`}
              aria-selected={active}
              aria-controls={`panel-${item.id}`}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(item.id)}
              className={[
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-slate-100 text-slate-900"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-800",
              ].join(" ")}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
