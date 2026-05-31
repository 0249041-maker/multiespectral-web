import { useEffect, useRef, useState } from "react";

/**
 * Botón circular de "i" que muestra/oculta un popover con más información.
 * Se cierra al hacer click fuera o presionar Escape.
 *
 * @param {{ label?: string, children: import("react").ReactNode }} props
 */
export default function InfoTooltip({ label = "Más información", children }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span className="relative inline-flex" ref={wrapRef}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-xs font-semibold text-slate-500 shadow-sm transition hover:border-emerald-300 hover:text-emerald-700"
      >
        i
      </button>
      {open ? (
        <span
          role="tooltip"
          className="absolute right-0 top-8 z-20 w-64 rounded-xl border border-slate-200 bg-white p-3 text-left text-xs text-slate-700 shadow-lg"
        >
          {children}
        </span>
      ) : null}
    </span>
  );
}
