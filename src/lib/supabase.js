import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
/** Nombre correcto: VITE_SUPABASE_ANON_KEY. Fallback por typo común en Vercel/.env */
const anonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KE;

export const supabase =
  url && anonKey ? createClient(url, anonKey) : null;

