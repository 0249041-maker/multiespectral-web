import { useCallback, useEffect, useRef, useState } from "react";
import { CAMERA_LIVE_WS_URL } from "@/lib/cameraDashboardConstants";

function resolveInitialWsUrl(fixedWsUrl, defaultWsUrl) {
  if (fixedWsUrl) return fixedWsUrl;
  const fromEnv = import.meta.env.VITE_FOCUS_LIVE_WS_URL;
  if (typeof fromEnv === "string" && fromEnv.trim().match(/^wss?:\/\//)) {
    return fromEnv.trim();
  }
  if (defaultWsUrl) return defaultWsUrl;
  try {
    const saved = window.localStorage.getItem("focus-live-ws-url");
    if (saved && (saved.startsWith("ws://") || saved.startsWith("wss://"))) {
      return saved;
    }
  } catch {
    // ignore
  }
  return "";
}

/**
 * Vista en vivo JPEG por WebSocket (focus_live_server / proxy TLS).
 * @param {{ fixedWsUrl?: string, defaultWsUrl?: string, title?: string, subtitle?: string, showHelp?: boolean, showUrlField?: boolean, embedded?: boolean, startButtonLabel?: string, autoStart?: boolean, hideStartButton?: boolean, hideHeader?: boolean, onCalibrationStart?: () => void }} props
 */
export default function FocusLiveTest({
  fixedWsUrl = null,
  defaultWsUrl = "",
  title = "Vista en vivo",
  subtitle = "Stream JPEG desde la cámara multiespectral.",
  showHelp = true,
  showUrlField,
  embedded = false,
  startButtonLabel = "Iniciar vista en vivo",
  stopButtonLabel,
  autoStart = false,
  hideStartButton = false,
  hideHeader = false,
  onCalibrationStart,
}) {
  const stopLabel =
    stopButtonLabel ??
    (startButtonLabel === "Iniciar calibración" ? "Detener calibración" : "Detener");
  const urlLocked = Boolean(fixedWsUrl);
  const displayUrlField = showUrlField ?? !urlLocked;

  const [wsUrl, setWsUrl] = useState(() =>
    resolveInitialWsUrl(fixedWsUrl, defaultWsUrl)
  );
  const [connected, setConnected] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  const [frameUrl, setFrameUrl] = useState("");
  const [closeDiag, setCloseDiag] = useState(null);

  const socketRef = useRef(null);
  const lastObjectUrlRef = useRef(null);

  useEffect(() => {
    if (fixedWsUrl) setWsUrl(fixedWsUrl);
  }, [fixedWsUrl]);

  const persistUrl = (url) => {
    if (urlLocked) return;
    try {
      window.localStorage.setItem("focus-live-ws-url", url);
    } catch {
      // ignore
    }
  };

  const explainCloseCode = (code, reason) => {
    if (code === 1006) {
      return "1006 = cierre anormal: no hubo handshake TCP o se cortó la red (proxy, firewall o servidor no escuchando).";
    }
    if (code === 1002) {
      return "1002 = error de protocolo (raro con JPEG binario).";
    }
    if (code === 1000 && reason) {
      return `Cierre normal del servidor: ${reason}`;
    }
    return reason || `Código ${code}${code === 1000 ? " (cierre normal)" : ""}.`;
  };

  const startStream = useCallback(() => {
    setError("");
    setCloseDiag(null);

    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }

    const trimmed = (fixedWsUrl || wsUrl).trim();
    if (!trimmed) {
      setError("No hay URL de WebSocket configurada.");
      return;
    }
    if (!trimmed.startsWith("ws://") && !trimmed.startsWith("wss://")) {
      setError("La URL debe empezar por ws:// o wss://.");
      return;
    }
    if (
      typeof window !== "undefined" &&
      window.location.protocol === "https:" &&
      trimmed.startsWith("ws://")
    ) {
      setError(
        "Esta página está en HTTPS: usa wss:// o abre el sitio en http://localhost para probar ws:// en LAN."
      );
      return;
    }
    persistUrl(trimmed);
    onCalibrationStart?.();

    const socket = new WebSocket(trimmed);
    socket.binaryType = "arraybuffer";

    socket.onopen = () => {
      setConnected(true);
      setStreaming(true);
      setError("");
    };

    socket.onmessage = (event) => {
      if (typeof event.data === "string") {
        try {
          const msg = JSON.parse(event.data);
          console.log("Camera message:", msg);
        } catch {
          console.log("Camera text (non-JSON):", event.data);
        }
        return;
      }

      const blob = new Blob([event.data], { type: "image/jpeg" });
      const url = URL.createObjectURL(blob);
      setFrameUrl(url);

      if (lastObjectUrlRef.current) {
        URL.revokeObjectURL(lastObjectUrlRef.current);
      }
      lastObjectUrlRef.current = url;
    };

    socket.onerror = () => {
      setError(
        "Error de WebSocket (revisa el código de cierre abajo). Comprueba que el servidor esté activo y la URL sea correcta."
      );
      setConnected(false);
      setStreaming(false);
    };

    socket.onclose = (ev) => {
      setConnected(false);
      setStreaming(false);
      setCloseDiag({
        code: ev.code,
        reason: ev.reason || "",
        wasClean: ev.wasClean,
      });
      if (!ev.wasClean || ev.code === 1006) {
        setError(explainCloseCode(ev.code, ev.reason));
      }
    };

    socketRef.current = socket;
  }, [fixedWsUrl, wsUrl, onCalibrationStart]);

  const stopStream = () => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    setConnected(false);
    setStreaming(false);
  };

  useEffect(() => {
    return () => {
      if (socketRef.current) socketRef.current.close();
      if (lastObjectUrlRef.current) URL.revokeObjectURL(lastObjectUrlRef.current);
    };
  }, []);

  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (!autoStart || autoStartedRef.current) return;
    autoStartedRef.current = true;
    startStream();
  }, [autoStart, startStream]);

  const showStreamControls = !hideStartButton || streaming;

  const shellClass = embedded
    ? ""
    : "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5";

  return (
    <div className={shellClass}>
      {!hideHeader && (title || subtitle || urlLocked) ? (
        <div>
          {title ? (
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          ) : null}
          {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
          {urlLocked ? (
            <p className="mt-2 font-mono text-xs text-slate-500">
              WebSocket:{" "}
              <code className="rounded bg-slate-100 px-1 text-emerald-800">{fixedWsUrl}</code>
            </p>
          ) : null}
        </div>
      ) : null}

      {showHelp ? (
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <strong>HTTPS (Vercel):</strong> solo <code className="rounded bg-amber-100 px-0.5">wss://</code>.
          En local con <code className="rounded bg-amber-100 px-0.5">npm run dev</code> también puedes usar{" "}
          <code className="rounded bg-amber-100 px-0.5">ws://</code> en LAN.
        </p>
      ) : null}

      {showStreamControls ? (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
          {displayUrlField ? (
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <label htmlFor="focus-live-ws-url" className="text-sm font-medium text-slate-800">
                WebSocket URL
              </label>
              <input
                id="focus-live-ws-url"
                type="text"
                value={wsUrl}
                onChange={(e) => setWsUrl(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                placeholder="wss://camera.multispectralcam.com"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          ) : null}

          {!hideStartButton && !streaming ? (
            <button
              type="button"
              onClick={startStream}
              className="shrink-0 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
            >
              {startButtonLabel}
            </button>
          ) : null}
          {streaming ? (
            <button
              type="button"
              onClick={stopStream}
              className="shrink-0 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700"
            >
              {stopLabel}
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 text-sm text-slate-700">
        Estado:{" "}
        <span
          className={
            connected ? "font-semibold text-emerald-600" : "font-medium text-slate-500"
          }
        >
          {connected ? "Conectado" : "Desconectado"}
        </span>
      </div>

      {closeDiag ? (
        <p className="mt-2 font-mono text-[11px] text-slate-500">
          WebSocket cierre: código {closeDiag.code}
          {closeDiag.reason ? ` · ${closeDiag.reason}` : ""}
          {closeDiag.wasClean ? " · limpio" : " · no limpio"}
        </p>
      ) : null}

      {error ? (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-black">
        {frameUrl ? (
          <img
            src={frameUrl}
            alt="Fotograma en vivo de la cámara"
            className="max-h-[min(70vh,520px)] w-full object-contain"
          />
        ) : (
          <div className="flex h-[min(50vh,420px)] min-h-[240px] items-center justify-center px-4 text-center text-sm text-slate-400">
            {streaming
              ? "Esperando fotogramas…"
              : `Pulsa «${startButtonLabel}» para conectar al stream.`}
          </div>
        )}
      </div>
    </div>
  );
}

/** Re-export para imports que usen la URL de calibración por defecto. */
export { CAMERA_LIVE_WS_URL };
