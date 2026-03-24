import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { signedUrlFromPublicStorageUrl } from "@/lib/supabaseStorageUrl";

/**
 * Muestra una imagen; si es URL de Supabase Storage, intenta URL firmada
 * para que cargue aunque el acceso público directo falle.
 */
export default function SupabaseImage({ src, alt, className }) {
  const [resolved, setResolved] = useState(src);
  const [failed, setFailed] = useState(false);
  const fallbackTried = useRef(false);

  useEffect(() => {
    setFailed(false);
    fallbackTried.current = false;
    setResolved(src);
    if (!src || !supabase || src.startsWith("blob:") || src.startsWith("data:")) {
      return;
    }
    let cancelled = false;
    (async () => {
      const signed = await signedUrlFromPublicStorageUrl(src);
      if (!cancelled && signed) setResolved(signed);
    })();
    return () => {
      cancelled = true;
    };
  }, [src]);

  if (!src) return null;

  return (
    <div className="flex flex-col items-center">
      <img
        src={resolved}
        alt={alt}
        className={className}
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
