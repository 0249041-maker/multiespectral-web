-- Estado de la cámara multiespectral: URL del túnel Cloudflare (WebSocket) y flag online.
-- Políticas anon alineadas con la app (solo fila camera_001).

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
