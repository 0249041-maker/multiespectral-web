import {
  CAMERA_NAV_GROUPS,
  CAMERA_WORKFLOW_STEPS,
} from "@/lib/cameraDashboardConstants";

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
  Sistema: "sys",
};

const WORKFLOW_STEP_ICON = {
  config: "config",
  calFilters: "cal",
  calFocus: "cal",
  calWhite: "cal",
  capture: "cap",
};

function StepCircle({ completed, active }) {
  return (
    <span
      className={`relative z-10 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
        completed
          ? "border-emerald-500 bg-emerald-500 text-white"
          : active
            ? "border-emerald-400 bg-white"
            : "border-slate-300 bg-white"
      }`}
      aria-hidden
    >
      {completed ? (
        <svg className="h-2.5 w-2.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            active ? "bg-emerald-400" : "bg-slate-300"
          }`}
        />
      )}
    </span>
  );
}

function WorkflowStepRow({ step, stepIndex, completed, activeId, onSelect }) {
  const isLast = stepIndex === CAMERA_WORKFLOW_STEPS.length - 1;
  const isActive = step.items.some((item) => item.sectionId === activeId);
  const icon = WORKFLOW_STEP_ICON[step.id] || "cal";

  return (
    <div className="flex gap-2">
      <div className="flex w-5 shrink-0 flex-col items-center">
        <div className="flex h-9 items-center">
          <StepCircle completed={completed} active={isActive} />
        </div>
        {!isLast ? (
          <div
            className={`w-0.5 flex-1 min-h-[0.5rem] ${
              completed ? "bg-emerald-400" : "bg-slate-200"
            }`}
          />
        ) : null}
      </div>

      <div className={`min-w-0 flex-1 ${isLast ? "pb-0" : "pb-1"}`}>
        <p className="mb-0.5 hidden px-1 text-[10px] font-medium text-slate-500 lg:block">
          {step.label}
        </p>
        <div className="flex flex-col gap-0.5">
          {step.items.map((item) => {
            const active = activeId === item.sectionId;
            return (
              <button
                key={item.sectionId}
                type="button"
                onClick={() => onSelect(item.sectionId)}
                className={`flex min-w-[9rem] items-center gap-2 rounded-xl px-2 py-2 text-left text-sm transition lg:min-w-0 lg:px-2 ${
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
    </div>
  );
}

function NavGroup({ group, activeId, onSelect }) {
  const icon = GROUP_ICON[group.label] || "sys";
  return (
    <div className="lg:mb-4">
      <p className="hidden px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 lg:block">
        {group.label}
      </p>
      <div className="flex gap-1 lg:flex-col">
        {group.items.map((item) => {
          const active = activeId === item.id;
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
  );
}

/**
 * @param {{
 *   activeId: string,
 *   onSelect: (id: string) => void,
 *   workflowStatus: Record<string, boolean>,
 * }} props
 */
export default function CameraSidebar({ activeId, onSelect, workflowStatus }) {
  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-slate-200 bg-white lg:w-60 lg:border-b-0 lg:border-r xl:w-64">
      <div className="border-b border-slate-200 px-3 py-3 lg:px-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Panel de instrumentación
        </p>
        <p className="mt-1 text-xs text-slate-500">Raspberry Pi 5 · multiespectral</p>
      </div>
      <nav className="flex flex-1 gap-1 overflow-x-auto px-2 py-2 lg:flex-col lg:overflow-y-auto lg:px-2 lg:py-3">
        <div className="lg:mb-2 lg:mt-1">
          <p className="hidden px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 lg:block">
            Flujo de trabajo
          </p>
          <div className="hidden lg:block">
            {CAMERA_WORKFLOW_STEPS.map((step, index) => (
              <WorkflowStepRow
                key={step.id}
                step={step}
                stepIndex={index}
                completed={Boolean(workflowStatus?.[step.id])}
                activeId={activeId}
                onSelect={onSelect}
              />
            ))}
          </div>
          <div className="flex gap-1 lg:hidden">
            {CAMERA_WORKFLOW_STEPS.flatMap((step) =>
              step.items.map((item) => {
                const active = activeId === item.sectionId;
                const completed = Boolean(workflowStatus?.[step.id]);
                return (
                  <button
                    key={item.sectionId}
                    type="button"
                    onClick={() => onSelect(item.sectionId)}
                    title={step.label}
                    className={`relative flex min-w-[7.5rem] flex-col items-start rounded-xl border px-2 py-2 text-left text-xs ${
                      active
                        ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                        : "border-slate-200 text-slate-600"
                    }`}
                  >
                    <span
                      className={`mb-1 h-2.5 w-2.5 rounded-full border ${
                        completed
                          ? "border-emerald-500 bg-emerald-500"
                          : "border-slate-300 bg-white"
                      }`}
                    />
                    <span className="font-medium">{item.short}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {CAMERA_NAV_GROUPS.filter((g) => g.label === "Sistema").map((group) => (
          <NavGroup key={group.label} group={group} activeId={activeId} onSelect={onSelect} />
        ))}
      </nav>
    </aside>
  );
}
