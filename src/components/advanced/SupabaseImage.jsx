import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  parsePublicStorageUrl,
  signedUrlFromPublicStorageUrl,
} from "@/lib/supabaseStorageUrl";

/**
 * Muestra una imagen; si es URL de Supabase Storage, prioriza URL firmada
 * (funciona aunque el acceso público directo falle o haya diferencias de URL).
 */
export default function SupabaseImage({ src, alt, className }) {
  const [resolved, setResolved] = useState(src);
  const [failed, setFailed] = useState(false);
  const fallbackTried = useRef(false);

  useEffect(() => {
    setFailed(false);
    fallbackTried.current = false;

    if (!src) {
      setResolved("");
      return;
    }
    if (src.startsWith("blob:") || src.startsWith("data:")) {
      setResolved(src);
      return;
    }

    if (!supabase || !parsePublicStorageUrl(src)) {
      setResolved(src);
      return;
    }

    let cancelled = false;
    setResolved(src);
    (async () => {
      const signed = await signedUrlFromPublicStorageUrl(src);
      if (cancelled) return;
      if (signed) setResolved(signed);
    })();
    return () => {
      cancelled = true;
    };
  }, [src]);

  if (!src) return null;

  return (
    <div className="flex flex-col items-center">
      <img
        src={resolved || src}
        alt={alt}
        className={className}
        referrerPolicy="no-referrer"
        onError={async () => {
          if (!src || src.startsWith("blob:")) {
            setFailed(true);
            return;
          }
          if (!fallbackTried.current) {
            fallbackTried.current = true;
            const fallback = await signedUrlFromPublicStorageUrl(src);
            if (fallback && fallback !== resolved) {
              setResolved(fallback);
              return;
            }
            if (!fallback && resolved !== src) {
              setResolved(src);
              return;
            }
          }
          setFailed(true);
        }}
      />
      {failed && (
        <p className="mt-2 max-w-md text-center text-xs text-red-300">
          No se pudo cargar la imagen. Revisa en Supabase: Storage → bucket{" "}
          <code className="rounded bg-slate-800 px-1">spectral-captures</code>{" "}
          (público) y el SQL{" "}
          <code className="rounded bg-slate-800 px-1 text-[10px]">
            configurar_acceso_publico.sql
          </code>
          .
        </p>
      )}
    </div>
  );
}
