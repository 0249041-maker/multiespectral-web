import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  normalizeSupabaseStorageImageUrl,
  parsePublicStorageUrl,
  publicStorageUrlToBlobUrl,
  signedUrlFromPublicStorageUrl,
} from "@/lib/supabaseStorageUrl";

/**
 * Carga imágenes de Supabase Storage: URL firmada y, si hace falta, descarga por API (blob).
 * Así se evitan fallos entre dispositivos cuando la URL pública directa no carga.
 */
export default function SupabaseImage({ src, alt, className }) {
  const [resolved, setResolved] = useState(() => src ?? "");
  const [failed, setFailed] = useState(false);
  const attemptRef = useRef(0);
  const blobUrlRef = useRef(null);

  useEffect(() => {
    setFailed(false);
    attemptRef.current = 0;

    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }

    if (!src) {
      setResolved("");
      return;
    }

    const normalized = normalizeSupabaseStorageImageUrl(src);

    if (normalized.startsWith("blob:") || normalized.startsWith("data:")) {
      setResolved(normalized);
      return;
    }

    if (!supabase || !parsePublicStorageUrl(normalized)) {
      setResolved(normalized);
      return;
    }

    let cancelled = false;

    async function loadRemote() {
      const signed = await signedUrlFromPublicStorageUrl(normalized);
      if (cancelled) return;
      if (signed) {
        setResolved(signed);
        return;
      }
      const blobUrl = await publicStorageUrlToBlobUrl(normalized);
      if (cancelled) return;
      if (blobUrl) {
        blobUrlRef.current = blobUrl;
        setResolved(blobUrl);
        return;
      }
      setResolved(normalized);
    }

    setResolved(normalized);
    void loadRemote();

    return () => {
      cancelled = true;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [src]);

  if (!src) return null;

  const handleError = async () => {
    const normalized = normalizeSupabaseStorageImageUrl(src);
    if (!normalized || normalized.startsWith("blob:")) {
      setFailed(true);
      return;
    }
    if (!supabase || !parsePublicStorageUrl(normalized)) {
      setFailed(true);
      return;
    }

    attemptRef.current += 1;
    const n = attemptRef.current;

    if (n === 1) {
      const signed = await signedUrlFromPublicStorageUrl(normalized);
      if (signed && signed !== resolved) {
        setResolved(signed);
        return;
      }
    }
    if (n === 2) {
      const blobUrl = await publicStorageUrlToBlobUrl(normalized);
      if (blobUrl) {
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = blobUrl;
        setResolved(blobUrl);
        return;
      }
    }

    setFailed(true);
  };

  return (
    <div className="flex flex-col items-center">
      <img
        src={resolved || normalizeSupabaseStorageImageUrl(src)}
        alt={alt}
        className={className}
        referrerPolicy="no-referrer"
        onError={handleError}
      />
      {failed && (
        <p className="mt-2 max-w-md text-center text-xs text-red-300">
          No se pudo cargar la imagen. En Supabase: Storage → bucket correcto
          (p. ej.{" "}
          <code className="rounded bg-slate-800 px-1">spectral-captures</code>)
          público o con política{" "}
          <code className="rounded bg-slate-800 px-1 text-[10px]">SELECT</code>{" "}
          para <code className="rounded bg-slate-800 px-1">anon</code>. Ejecuta{" "}
          <code className="rounded bg-slate-800 px-1 text-[10px]">
            configurar_acceso_publico.sql
          </code>
          .
        </p>
      )}
    </div>
  );
}
