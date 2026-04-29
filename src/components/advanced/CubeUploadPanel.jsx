import { useCallback, useEffect, useState } from "react";

const BANDS = [
  { key: "b", label: "450 nm · Azul (B)", short: "450" },
  { key: "g", label: "550 nm · Verde (G)", short: "550" },
  { key: "r", label: "656 nm · Rojo (R)", short: "656" },
  { key: "re", label: "725 nm · Borde rojo (RE)", short: "725" },
  { key: "nir", label: "850 nm · Infrarrojo cercano (NIR)", short: "850" },
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

function loadImageFromBlob(blob) {
  return new Promise((resolve, reject) => {
    const u = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(u);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(u);
      reject(new Error("No se pudo cargar imagen."));
    };
    img.src = u;
  });
}

function luminanceFromRgba(r, g, b) {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

async function buildWhiteReferenceNaturalRgbBlob(rBlob, gBlob, bBlob) {
  const [rImg, gImg, bImg] = await Promise.all([
    loadImageFromBlob(rBlob),
    loadImageFromBlob(gBlob),
    loadImageFromBlob(bBlob),
  ]);
  const w = rImg.width;
  const h = rImg.height;
  if (gImg.width !== w || gImg.height !== h || bImg.width !== w || bImg.height !== h) {
    throw new Error("Las bandas RGB del compensador deben tener el mismo tamaño.");
  }

  const mkData = (img) => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Canvas 2D no disponible.");
    ctx.drawImage(img, 0, 0, w, h);
    return ctx.getImageData(0, 0, w, h).data;
  };

  const rData = mkData(rImg);
  const gData = mkData(gImg);
  const bData = mkData(bImg);
  const n = w * h;

  // Balance simple: iguala medias para que la carta blanca tienda a neutral.
  let meanR = 0;
  let meanG = 0;
  let meanB = 0;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    meanR += luminanceFromRgba(rData[o], rData[o + 1], rData[o + 2]);
    meanG += luminanceFromRgba(gData[o], gData[o + 1], gData[o + 2]);
    meanB += luminanceFromRgba(bData[o], bData[o + 1], bData[o + 2]);
  }
  meanR /= n;
  meanG /= n;
  meanB /= n;
  const target = (meanR + meanG + meanB) / 3;
  const gainR = target / Math.max(1e-6, meanR);
  const gainG = target / Math.max(1e-6, meanG);
  const gainB = target / Math.max(1e-6, meanB);

  const outCanvas = document.createElement("canvas");
  outCanvas.width = w;
  outCanvas.height = h;
  const outCtx = outCanvas.getContext("2d");
  if (!outCtx) throw new Error("Canvas 2D no disponible.");
  const out = outCtx.createImageData(w, h);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const rv = luminanceFromRgba(rData[o], rData[o + 1], rData[o + 2]) * gainR;
    const gv = luminanceFromRgba(gData[o], gData[o + 1], gData[o + 2]) * gainG;
    const bv = luminanceFromRgba(bData[o], bData[o + 1], bData[o + 2]) * gainB;
    out.data[o] = Math.round(Math.max(0, Math.min(255, rv * 255)));
    out.data[o + 1] = Math.round(Math.max(0, Math.min(255, gv * 255)));
    out.data[o + 2] = Math.round(Math.max(0, Math.min(255, bv * 255)));
    out.data[o + 3] = 255;
  }
  outCtx.putImageData(out, 0, 0);

  return await new Promise((resolve, reject) => {
    outCanvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error("No se pudo generar RGB natural del compensador."));
      },
      "image/png",
      0.95
    );
  });
}

export default function CubeUploadPanel({
  onCubeAccepted,
  onApplyWhiteToSelected,
  hasSelectedCube = false,
  disabled,
}) {
  const [draft, setDraft] = useState(emptyDraft);
  const [whiteDraft, setWhiteDraft] = useState(emptyDraft);
  const [whiteReferenceSet, setWhiteReferenceSet] = useState(null);
  const [dragOverKey, setDragOverKey] = useState(null);
  const [dragOverWhiteKey, setDragOverWhiteKey] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [whiteMessage, setWhiteMessage] = useState(null);
  const [whiteRgbPreviewUrl, setWhiteRgbPreviewUrl] = useState("");

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

  const setWhiteFileForKey = useCallback((key, file) => {
    if (!file || !file.type.startsWith("image/")) return;
    setWhiteDraft((prev) => ({ ...prev, [key]: file }));
    setMessage(null);
  }, []);

  const handleWhiteDrop = useCallback(
    (key, e) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOverWhiteKey(null);
      const f = e.dataTransfer.files?.[0];
      if (f) setWhiteFileForKey(key, f);
    },
    [setWhiteFileForKey]
  );

  const handleWhiteFileInput = useCallback(
    (key, e) => {
      const f = e.target.files?.[0];
      if (f) setWhiteFileForKey(key, f);
      e.target.value = "";
    },
    [setWhiteFileForKey]
  );

  const hasRAndNir = Boolean(draft.r && draft.nir);
  const canSubmit = hasRAndNir;
  const pendingCount = BANDS.filter(({ key }) => !draft[key]).length;
  const whiteCount = BANDS.filter(({ key }) => Boolean(whiteDraft[key])).length;
  const whiteSetCount = whiteReferenceSet
    ? BANDS.filter(({ key }) => Boolean(whiteReferenceSet[key])).length
    : 0;

  const saveWhiteReference = () => {
    const next = {
      r: whiteDraft.r ?? null,
      g: whiteDraft.g ?? null,
      b: whiteDraft.b ?? null,
      re: whiteDraft.re ?? null,
      nir: whiteDraft.nir ?? null,
    };
    const count = BANDS.filter(({ key }) => Boolean(next[key])).length;
    if (count === 0) {
      setWhiteReferenceSet(null);
      setWhiteMessage("No hay referencia blanca activa.");
      return;
    }
    setWhiteReferenceSet(next);
    setWhiteMessage(
      `Referencia blanca guardada (${count}/5 bandas). Se aplicará a próximos cubes.`
    );
  };

  const applyWhiteToSelected = async () => {
    if (!onApplyWhiteToSelected || !hasSelectedCube || busy) return;
    if (!whiteReferenceSet) {
      setWhiteMessage("Guarda una referencia blanca antes de aplicarla.");
      return;
    }
    setBusy(true);
    setMessage(null);
    setWhiteMessage(null);
    try {
      const result = await onApplyWhiteToSelected(whiteReferenceSet);
      setWhiteMessage(
        `Cube seleccionado reprocesado y guardado con compensación en ${result?.compensatedCount ?? 0} banda(s).`
      );
    } catch (e) {
      setWhiteMessage(
        e instanceof Error
          ? e.message
          : "No se pudo aplicar la referencia al cube seleccionado."
      );
    } finally {
      setBusy(false);
    }
  };

  const clearWhiteReference = () => {
    setWhiteReferenceSet(null);
    setWhiteDraft(emptyDraft());
    setWhiteMessage("Referencia blanca desactivada.");
    if (whiteRgbPreviewUrl) {
      URL.revokeObjectURL(whiteRgbPreviewUrl);
      setWhiteRgbPreviewUrl("");
    }
  };

  const generateWhiteReferenceRgb = async () => {
    const source = whiteReferenceSet ?? whiteDraft;
    if (!source?.r || !source?.g || !source?.b) {
      setWhiteMessage(
        "Para generar RGB del compensador se requieren al menos R, G y B."
      );
      return;
    }
    setBusy(true);
    setWhiteMessage(null);
    try {
      const rgbBlob = await buildWhiteReferenceNaturalRgbBlob(
        source.r,
        source.g,
        source.b
      );

      const preview = URL.createObjectURL(rgbBlob);
      if (whiteRgbPreviewUrl) URL.revokeObjectURL(whiteRgbPreviewUrl);
      setWhiteRgbPreviewUrl(preview);
      setWhiteMessage("RGB natural del compensador generado.");
    } catch (e) {
      setWhiteMessage(
        e instanceof Error
          ? e.message
          : "No se pudo generar RGB del compensador."
      );
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    return () => {
      if (whiteRgbPreviewUrl) URL.revokeObjectURL(whiteRgbPreviewUrl);
    };
  }, [whiteRgbPreviewUrl]);

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
        whiteReferenceFiles: {
          r: whiteReferenceSet?.r ?? null,
          g: whiteReferenceSet?.g ?? null,
          b: whiteReferenceSet?.b ?? null,
          re: whiteReferenceSet?.re ?? null,
          nir: whiteReferenceSet?.nir ?? null,
        },
      });

      if (result?.savedToSupabase) {
        if (result?.compensatedCount > 0) {
          setMessage(
            `Cube guardado en la base de datos y en Storage con compensación radiométrica en ${result.compensatedCount} banda(s).`
          );
        } else {
          setMessage(
            "Cube guardado en la base de datos y en Storage. Cualquier persona con el enlace puede verlo al abrir o recargar la página."
          );
        }
      } else if (result?.persistError) {
        setMessage(result.persistError);
      } else {
        if (result?.compensatedCount > 0) {
          setMessage(
            `Cube añadido solo en este navegador con compensación en ${result.compensatedCount} banda(s).`
          );
        } else {
          setMessage("Cube añadido solo en este navegador (no visible para otros).");
        }
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
        <p className="mt-1 text-xs text-slate-500">
          Opcional: añade referencia blanca por banda para compensar la señal
          (fotones incidentes) en ese cube.
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

      <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Referencia blanca (flujo independiente)
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Carga aquí las imágenes de panel/fondo blanco y pulsa{" "}
          <strong>Guardar referencia</strong>. Esa referencia se aplica después
          a los cubes de planta hasta que la desactives.
          {whiteCount > 0 ? ` (${whiteCount}/5 preparadas)` : ""}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={saveWhiteReference}
            disabled={busy || disabled}
            className="rounded-md bg-cyan-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-800 disabled:opacity-50"
          >
            Guardar referencia
          </button>
          <button
            type="button"
            onClick={clearWhiteReference}
            disabled={busy || disabled}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Limpiar referencia
          </button>
          <button
            type="button"
            onClick={generateWhiteReferenceRgb}
            disabled={busy || disabled}
            className="rounded-md bg-fuchsia-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-fuchsia-800 disabled:opacity-50"
          >
            Generar RGB compensador
          </button>
          <button
            type="button"
            onClick={applyWhiteToSelected}
            disabled={busy || disabled || !hasSelectedCube || !whiteReferenceSet}
            className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            Aplicar al cube seleccionado
          </button>
          <span className="text-xs text-slate-500">
            {whiteSetCount > 0
              ? `Activa: ${whiteSetCount}/5 bandas`
              : "Sin referencia activa"}
          </span>
        </div>
        {whiteMessage && (
          <p className="mt-2 text-xs text-cyan-800">{whiteMessage}</p>
        )}
        {whiteRgbPreviewUrl && (
          <div className="mt-3 rounded-lg border border-fuchsia-200 bg-fuchsia-50/50 p-2">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-fuchsia-700">
              Vista RGB del compensador
            </p>
            <img
              src={whiteRgbPreviewUrl}
              alt="RGB del compensador"
              className="max-h-52 w-auto max-w-full rounded border border-fuchsia-100 object-contain"
            />
          </div>
        )}
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {BANDS.map(({ key, label, short }) => {
            const file = whiteDraft[key];
            const isOver = dragOverWhiteKey === key;
            return (
              <div key={`white-${key}`} className="flex flex-col gap-1">
                <span className="text-[11px] font-medium text-slate-600">
                  {label}
                </span>
                <label
                  className={`flex min-h-[110px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-2 py-3 text-center transition ${
                    isOver
                      ? "border-cyan-500 bg-cyan-50"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    setDragOverWhiteKey(key);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverWhiteKey(key);
                  }}
                  onDragLeave={() => setDragOverWhiteKey(null)}
                  onDrop={(e) => handleWhiteDrop(key, e)}
                >
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    disabled={disabled || busy}
                    onChange={(e) => handleWhiteFileInput(key, e)}
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
                      Blanco ref. · {short}
                    </span>
                  )}
                </label>
              </div>
            );
          })}
        </div>
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
            className={`max-w-xl text-xs ${
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
