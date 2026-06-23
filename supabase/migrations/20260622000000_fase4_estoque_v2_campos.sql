-- ================================================================
-- Fase 4.0: Estoque V2 — campos extras + vínculo lead ↔ veículo
-- Todos nullable — zero impacto no cliente piloto (0 veículos, 6 leads)
-- ================================================================

-- A. Campos extras em vehicles
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS version         TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fuel            TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS transmission    TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deal_offer      TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS description     TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS photo_main_url  TEXT DEFAULT NULL;

-- B. Vínculo lead → veículo específico do estoque
--    ON DELETE SET NULL: se o veículo for excluído, o link some mas os textos ficam
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS interest_vehicle_id UUID
    REFERENCES public.vehicles(id) ON DELETE SET NULL;

-- C. Índices para performance
CREATE INDEX IF NOT EXISTS idx_customers_interest_vehicle
  ON public.customers(interest_vehicle_id)
  WHERE interest_vehicle_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vehicles_tenant_status
  ON public.vehicles(tenant_id, status);
