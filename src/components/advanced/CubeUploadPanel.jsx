import { useCallback, useEffect, useState } from "react";

const BANDS = [
  { key: "r", label: "Rojo (R)", short: "R" },
  { key: "g", label: "Verde (G)", short: "G" },
  { key: "b", label: "Azul (B)", short: "B" },
  { key: "re", label: "Borde rojo (RE)", short: "RE" },
  { key: "nir", label: "Infrarrojo cercano (NIR)", short: "NIR" },
];

function emptyDraft() {
  return { r: null, g: null, b: null, re: null, nir: null };
}

function DraftImagePreview({ file }) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (!file) {
      setUrl("");
      return;
    }
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  if (!file || !url) return null;
  return (
    <img
      src={url}
      alt=""
      className="mb-1 h-14 w-full max-w-[100px] rounded object-cover"
    />
  );
}

export default function CubeUploadPanel({ onCubeAccepted, disabled }) {
  const [draft, setDraft] = useState(emptyDraft);
  const [dragOverKey, setDragOverKey] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const setFileForKey = useCallback((key, file) => {
    if (!file || !file.type.startsWith("image/")) return;
    setDraft((prev) => ({ ...prev, [key]: file }));
    setMessage(null);
  }, []);

  const handleDrop = useCallback(
    (key, e) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOverKey(null);
      const f = e.dataTransfer.files?.[0];
      if (f) setFileForKey(key, f);
    },
    [setFileForKey]
  );

  const handleFileInput = useCallback(
    (key, e) => {
      const f = e.target.files?.[0];
      if (f) setFileForKey(key, f);
      e.target.value = "";
    },
    [setFileForKey]
  );

  const hasRAndNir = Boolean(draft.r && draft.nir);
  const canSubmit = hasRAndNir;
  const pendingCount = BANDS.filter(({ key }) => !draft[key]).length;

  const handleAccept = async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await onCubeAccepted({
        files: {
          r: draft.r,
          g: draft.g,
          b: draft.b,
          re: draft.re,
          nir: draft.nir,
        },
      });

      if (result?.savedToSupabase) {
        setMessage("Cube guardado en Supabase.");
      } else if (result?.persistError) {
        setMessage(result.persistError);
      } else {
        setMessage("Cube añadido en esta sesión.");
      }
      setDraft(emptyDraft());
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Error al procesar el cube."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-6 rounded-xl border border-dashed border-slate-300 bg-slate-50/80 p-4">
      <div className="mb-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Nuevo cube espectral
        </p>
        <p className="mt-1 text-sm text-slate-600">
          Arrastra una imagen por cada banda. Mínimo <strong>R</strong> y{" "}
          <strong>NIR</strong> para poder procesar NDVI en el desplegable. Si
          subes las cinco, verás también RGB y cada canal.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {BANDS.map(({ key, label, short }) => {
          const file = draft[key];
          const isOver = dragOverKey === key;
          return (
            <div key={key} className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-slate-600">
                {label}
              </span>
              <label
                className={`flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-2 py-3 text-center transition ${
                  isOver
                    ? "border-emerald-500 bg-emerald-50"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
                onDragEnter={(e) => {
                  e.preventDefault();
                  setDragOverKey(key);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverKey(key);
                }}
                onDragLeave={() => setDragOverKey(null)}
                onDrop={(e) => handleDrop(key, e)}
              >
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  disabled={disabled || busy}
                  onChange={(e) => handleFileInput(key, e)}
                />
                {file ? (
                  <>
                    <DraftImagePreview file={file} />
                    <span className="line-clamp-2 text-[10px] text-slate-600">
                      {file.name}
                    </span>
                  </>
                ) : (
                  <span className="text-[11px] text-slate-400">
                    Suelta aquí o haz clic · {short}
                  </span>
                )}
              </label>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!canSubmit || busy || disabled}
          onClick={handleAccept}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Procesando…" : "Aceptar"}
        </button>
        {!canSubmit && (
          <span className="text-xs text-slate-500">
            Sube al menos <strong>R</strong> y <strong>NIR</strong> para
            continuar.
            {pendingCount > 0 && ` (${pendingCount} pendientes)`}
          </span>
        )}
        {message && (
          <span
            className={`text-xs ${
              message.startsWith("Cube guardado")
                ? "text-emerald-700"
                : "text-amber-700"
            }`}
          >
            {message}
          </span>
        )}
      </div>
    </div>
  );
}
