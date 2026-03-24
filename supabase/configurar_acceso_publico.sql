-- Ejecuta este script en Supabase → SQL Editor para que CUALQUIERA
-- pueda ver los cubes y las imágenes desde cualquier computadora.
--
-- Pasos:
-- 1. Supabase Dashboard → SQL Editor → New query
-- 2. Pega todo este archivo y ejecuta (Run)
-- 3. Asegúrate de tener .env con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY

-- ============================================
-- 0. Crear bucket de Storage (si no existe)
-- ============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('spectral-captures', 'spectral-captures', true, 52428800, ARRAY['image/png', 'image/jpeg', 'image/webp']::text[])
ON CONFLICT (id) DO UPDATE SET public = true;

-- ============================================
-- 1. Tabla captures: permitir lectura anónima
-- ============================================
ALTER TABLE public.captures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "captures_anon_select" ON public.captures;
CREATE POLICY "captures_anon_select"
  ON public.captures FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "captures_anon_insert" ON public.captures;
CREATE POLICY "captures_anon_insert"
  ON public.captures FOR INSERT
  TO anon
  WITH CHECK (true);

-- ============================================
-- 2. Tabla capture_images: permitir lectura anónima
-- ============================================
ALTER TABLE public.capture_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "capture_images_anon_select" ON public.capture_images;
CREATE POLICY "capture_images_anon_select"
  ON public.capture_images FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "capture_images_anon_insert" ON public.capture_images;
CREATE POLICY "capture_images_anon_insert"
  ON public.capture_images FOR INSERT
  TO anon
  WITH CHECK (true);

-- ============================================
-- 3. Storage: bucket spectral-captures público
-- ============================================
-- Primero crea el bucket en Dashboard → Storage → New bucket
-- Nombre: spectral-captures
-- Public bucket: SÍ (o ejecuta las políticas de abajo)

-- Permiso para LEER imágenes (cualquiera puede verlas)
DROP POLICY IF EXISTS "spectral_storage_anon_select" ON storage.objects;
CREATE POLICY "spectral_storage_anon_select"
  ON storage.objects FOR SELECT
  TO anon
  USING (bucket_id = 'spectral-captures');

-- Permiso para SUBIR imágenes (cualquiera puede subir al crear cubes)
DROP POLICY IF EXISTS "spectral_storage_anon_insert" ON storage.objects;
CREATE POLICY "spectral_storage_anon_insert"
  ON storage.objects FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'spectral-captures');

-- Opcional: columna img_ndvi si no existe
ALTER TABLE public.capture_images
ADD COLUMN IF NOT EXISTS img_ndvi text;
