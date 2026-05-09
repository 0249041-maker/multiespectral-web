-- Ejecuta este script en Supabase → SQL Editor para que CUALQUIERA
-- pueda ver los cubes y las imágenes desde cualquier computadora.
--
-- Pasos:
-- 1. Supabase Dashboard → SQL Editor → New query
-- 2. Pega todo este archivo y ejecuta (Run)
-- 3. En .env / Vercel usa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (termina en KEY)

-- ============================================
-- 0. Buckets de Storage (capture_image = actual por defecto en la app; spectral-captures = compatibilidad)
-- ============================================
-- Tipos permitidos en subida (Storage valida el MIME). Incluye BMP (algunos navegadores usan image/x-ms-bmp).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'capture_image',
  'capture_image',
  true,
  52428800,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/bmp', 'image/x-ms-bmp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'spectral-captures',
  'spectral-captures',
  true,
  52428800,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/bmp', 'image/x-ms-bmp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

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
-- 3. Storage: políticas para bucket capture_image (y spectral-captures si tenías datos antiguos)
-- ============================================

DROP POLICY IF EXISTS "spectral_storage_anon_select" ON storage.objects;
CREATE POLICY "spectral_storage_anon_select"
  ON storage.objects FOR SELECT
  TO anon
  USING (bucket_id IN ('capture_image', 'spectral-captures'));

DROP POLICY IF EXISTS "spectral_storage_anon_insert" ON storage.objects;
CREATE POLICY "spectral_storage_anon_insert"
  ON storage.objects FOR INSERT
  TO anon
  WITH CHECK (bucket_id IN ('capture_image', 'spectral-captures'));

DROP POLICY IF EXISTS "captures_anon_delete" ON public.captures;
CREATE POLICY "captures_anon_delete"
  ON public.captures FOR DELETE
  TO anon
  USING (true);

DROP POLICY IF EXISTS "capture_images_anon_delete" ON public.capture_images;
CREATE POLICY "capture_images_anon_delete"
  ON public.capture_images FOR DELETE
  TO anon
  USING (true);

DROP POLICY IF EXISTS "spectral_storage_anon_delete" ON storage.objects;
CREATE POLICY "spectral_storage_anon_delete"
  ON storage.objects FOR DELETE
  TO anon
  USING (bucket_id IN ('capture_image', 'spectral-captures'));

-- Opcional: columna img_ndvi si no existe
ALTER TABLE public.capture_images
ADD COLUMN IF NOT EXISTS img_ndvi text;

-- ============================================
-- 4. Cámara multiespectral: túnel Cloudflare (tunnel_url) en camera_status
-- ============================================
CREATE TABLE IF NOT EXISTS public.camera_status (
  id text PRIMARY KEY,
  tunnel_url text,
  online boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.camera_status (id, tunnel_url, online)
VALUES ('camera_001', NULL, false)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.camera_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow read camera status" ON public.camera_status;
CREATE POLICY "allow read camera status"
  ON public.camera_status FOR SELECT
  TO anon
  USING (id = 'camera_001');

DROP POLICY IF EXISTS "allow upsert camera status" ON public.camera_status;
CREATE POLICY "allow upsert camera status"
  ON public.camera_status FOR INSERT
  TO anon
  WITH CHECK (id = 'camera_001');

DROP POLICY IF EXISTS "allow update camera status" ON public.camera_status;
CREATE POLICY "allow update camera status"
  ON public.camera_status FOR UPDATE
  TO anon
  USING (id = 'camera_001')
  WITH CHECK (id = 'camera_001');
