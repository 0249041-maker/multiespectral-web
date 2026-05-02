import { useEffect, useRef, useState } from "react";

const DEFAULT_WS = "ws://192.168.1.149:8765";

/**
 * Prueba de vista en vivo: la Raspberry envía JPEG binario por WebSocket.
 * Usar la app con `npm run dev` (http://localhost) si la página HTTPS bloquea ws://.
 */
export default function FocusLiveTest() {
  const [wsUrl, setWsUrl] = useState(() => {
    try {
      const saved = window.localStorage.getItem("focus-live-ws-url");
      return saved && saved.startsWith("ws") ? saved : DEFAULT_WS;
    } catch {
      return DEFAULT_WS;
    }
  });
  const [connected, setConnected] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  const [frameUrl, setFrameUrl] = useState("");
  /** Último cierre WS (los navegadores no detallan onerror; el código ayuda a diagnosticar). */
  const [closeDiag, setCloseDiag] = useState(null);

  const socketRef = useRef(null);
  const lastObjectUrlRef = useRef(null);

  const persistUrl = (url) => {
    try {
      window.localStorage.setItem("focus-live-ws-url", url);
    } catch {
      // ignore
    }
  };

  const explainCloseCode = (code, reason) => {
    if (code === 1006) {
      return "1006 = cierre anormal: no hubo handshake TCP o se cortó la red (IP/puerto mal, firewall en la Pi, cable/WiFi, o servidor no está escuchando).";
    }
    if (code === 1002) {
      return "1002 = error de protocolo (raro con JPEG binario).";
    }
    if (code === 1000 && reason) {
      return `Cierre normal del servidor: ${reason}`;
    }
    return reason || `Código ${code}${code === 1000 ? " (cierre normal)" : ""}.`;
  };

  const startStream = () => {
    setError("");
    setCloseDiag(null);

    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }

    const trimmed = wsUrl.trim();
    if (!trimmed.startsWith("ws://") && !trimmed.startsWith("wss://")) {
      setError('La URL debe empezar por ws:// o wss:// (ej. ws://192.168.1.149:8765).');
      return;
    }
    persistUrl(trimmed);

    const socket = new WebSocket(trimmed);
    socket.binaryType = "arraybuffer";

    socket.onopen = () => {
      setConnected(true);
      setStreaming(true);
      setError("");
    };

    socket.onmessage = (event) => {
      const blob = new Blob([event.data], { type: "image/jpeg" });
      const objectUrl = URL.createObjectURL(blob);

      setFrameUrl(objectUrl);

      if (lastObjectUrlRef.current) {
        URL.revokeObjectURL(lastObjectUrlRef.current);
      }

      lastObjectUrlRef.current = objectUrl;
    };

    socket.onerror = () => {
      // En la práctica el navegador no expone el motivo aquí; ver onclose.
      setError(
        "Error de WebSocket (revisa abajo el código de cierre). Comprueba IP, puerto 8765, firewall en la Pi y que uses http://localhost con npm run dev si estás en HTTPS."
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
  };

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
      if (socketRef.current) {
        socketRef.current.close();
      }

      if (lastObjectUrlRef.current) {
        URL.revokeObjectURL(lastObjectUrlRef.current);
      }
    };
  }, []);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
      <h2 className="text-lg font-semibold text-slate-900">
        Vista en vivo · calibración de enfoque
      </h2>

      <p className="mt-1 text-sm text-slate-600">
        Conecta al stream JPEG de la Raspberry (<code className="rounded bg-slate-100 px-1 text-xs">focus_live_server.py</code>
        , puerto 8765). Sin guardar imágenes ni WebRTC; solo prueba de visualización.
      </p>

      <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        Si abres el sitio desde <strong>HTTPS</strong> (Vercel), el navegador puede bloquear{" "}
        <code className="rounded bg-amber-100 px-0.5">ws://</code>. Para probar, usa{" "}
        <code className="rounded bg-amber-100 px-0.5">npm run dev</code> en{" "}
        <code className="rounded bg-amber-100 px-0.5">http://localhost:5173</code>.
      </p>

      <details className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
        <summary className="cursor-pointer font-medium text-slate-800">
          Si no conecta: comprobar en la Raspberry
        </summary>
        <ul className="mt-2 list-inside list-disc space-y-1 pl-0.5">
          <li>
            ¿Corre el servidor?{" "}
            <code className="rounded bg-white px-1">sudo python3 focus_live_server.py</code> y debes ver{" "}
            <code className="rounded bg-white px-1">WebSocket live server running on ws://0.0.0.0:8765</code>.
          </li>
          <li>
            Si falla antes, suele ser la cámara (eth0, MVSDK): el proceso termina y no hay puerto abierto.
          </li>
          <li>
            Firewall: <code className="rounded bg-white px-1">sudo ufw status</code> → permitir{" "}
            <code className="rounded bg-white px-1">8765/tcp</code> o desactivar UFW para la prueba.
          </li>
          <li>
            IP correcta: en la Pi <code className="rounded bg-white px-1">ip -br a</code> (wlan0) — la URL debe ser{" "}
            <code className="rounded bg-white px-1">ws://ESE_IP:8765</code>, mismo WiFi que el PC.
          </li>
          <li>
            Desde el PC: <code className="rounded bg-white px-1">nc -zv IP_PI 8765</code> (debe decir “succeeded”).
          </li>
        </ul>
      </details>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-stretch">
        <input
          type="text"
          value={wsUrl}
          onChange={(e) => setWsUrl(e.target.value)}
          className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          placeholder="ws://192.168.1.149:8765"
          autoComplete="off"
          spellCheck={false}
        />

        {!streaming ? (
          <button
            type="button"
            onClick={startStream}
            className="shrink-0 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
          >
            Iniciar vista en vivo
          </button>
        ) : (
          <button
            type="button"
            onClick={stopStream}
            className="shrink-0 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700"
          >
            Detener
          </button>
        )}
      </div>

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

      <div className="mt-4 overflow-hidden rounded-2xl bg-black">
        {frameUrl ? (
          <img
            src={frameUrl}
            alt="Fotograma en vivo de la cámara"
            className="max-h-[min(70vh,520px)] w-full object-contain"
          />
        ) : (
          <div className="flex h-[min(50vh,420px)] min-h-[240px] items-center justify-center px-4 text-center text-sm text-slate-400">
            Aún no hay fotogramas. Inicia el servidor en la Raspberry y pulsa «Iniciar vista en vivo».
          </div>
        )}
      </div>
    </div>
  );
}
