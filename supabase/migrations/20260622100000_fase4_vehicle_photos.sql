-- ================================================================
-- Fase 4.1: Galeria de fotos de veículos + Storage bucket
-- ================================================================

-- A. Tabela de fotos
CREATE TABLE IF NOT EXISTS public.vehicle_photos (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id  UUID        NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  tenant_id   UUID        NOT NULL DEFAULT meu_tenant_id() REFERENCES public.tenants(id),
  url         TEXT        NOT NULL,
  path        TEXT        NOT NULL,
  ordem       INT         NOT NULL DEFAULT 0,
  is_main     BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_photos_vehicle
  ON public.vehicle_photos(vehicle_id, ordem);

-- B. RLS
ALTER TABLE public.vehicle_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vp_select" ON public.vehicle_photos
  FOR SELECT USING (tenant_id = meu_tenant_id());

CREATE POLICY "vp_insert" ON public.vehicle_photos
  FOR INSERT WITH CHECK (tenant_id = meu_tenant_id());

CREATE POLICY "vp_update" ON public.vehicle_photos
  FOR UPDATE USING (tenant_id = meu_tenant_id());

CREATE POLICY "vp_delete" ON public.vehicle_photos
  FOR DELETE USING (tenant_id = meu_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_photos TO authenticated;
GRANT ALL ON public.vehicle_photos TO service_role;

-- C. Storage bucket para fotos de veículos (público — fotos são material de marketing)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vehicle-photos',
  'vehicle-photos',
  true,
  5242880,
  ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- D. Políticas de storage

-- Upload: apenas usuários autenticados do mesmo tenant (path = {tenant_id}/{vehicle_id}/arquivo)
CREATE POLICY "vp_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'vehicle-photos'
    AND split_part(name, '/', 1) = (public.meu_tenant_id())::text
  );

-- Leitura pública (bucket público — URLs funcionam sem auth)
CREATE POLICY "vp_storage_select" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'vehicle-photos');

-- Deleção: apenas mesmo tenant
CREATE POLICY "vp_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'vehicle-photos'
    AND split_part(name, '/', 1) = (public.meu_tenant_id())::text
  );
