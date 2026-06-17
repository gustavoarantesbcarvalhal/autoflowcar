-- ================================================================
-- Fase 3.6.2: Campos financeiros em vehicles
-- Todos nullable, zero impacto nos registros existentes
-- ================================================================

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS price_listed  NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS price_min_neg NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS price_fipe    NUMERIC DEFAULT NULL;
