import { getSupabaseEnvDebug } from "@/lib/supabase";

/**
 * Aviso global si Supabase no está configurado en el build o el cliente falló al crearse.
 */
export default function SupabaseEnvBanner() {
  const d = getSupabaseEnvDebug();

  if (d.configured && !d.clientError) {
    return null;
  }

  return (
    <div
      role="alert"
      className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950"
    >
      <p className="font-semibold">Supabase no está activo en esta versión</p>
      <ul className="mt-2 list-inside list-disc space-y-1 text-red-900">
        {!d.hasUrl && (
          <li>
            Falta <code className="rounded bg-red-100 px-1">VITE_SUPABASE_URL</code>{" "}
            en el build (añádela en Vercel → Environment Variables y haz{" "}
            <strong>Redeploy</strong>).
          </li>
        )}
        {!d.hasKey && (
          <li>
            Falta la clave anónima: usa{" "}
            <code className="rounded bg-red-100 px-1">VITE_SUPABASE_ANON_KEY</code>{" "}
            o{" "}
            <code className="rounded bg-red-100 px-1">VITE_SUPABASE_ANON_KE</code>{" "}
            (mismo valor que la anon key en Supabase → Settings → API).
          </li>
        )}
        {d.hasUrl && !d.urlOk && (
          <li>
            La URL debería empezar por{" "}
            <code className="rounded bg-red-100 px-1">https://</code> (p. ej.{" "}
            <code className="rounded bg-red-100 px-1 text-xs">
              https://xxxxx.supabase.co
            </code>
            ).
          </li>
        )}
        {d.clientError && (
          <li>
            Error al crear el cliente: {d.clientError}
          </li>
        )}
      </ul>
      <p className="mt-2 text-xs text-red-800">
        Las variables{" "}
        <code className="rounded bg-red-100 px-1">VITE_*</code> solo entran en el
        sitio cuando Vercel <strong>construye</strong> el proyecto; cambiar variables
        sin Redeploy deja el sitio viejo.
      </p>
    </div>
  );
}
