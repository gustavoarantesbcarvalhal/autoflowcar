-- ================================================================
-- Fase 3: Central de Follow-up Comercial
-- ================================================================

-- A. Campos de próxima ação programada nos leads
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS next_action_type  TEXT,
  ADD COLUMN IF NOT EXISTS next_action_notes TEXT;

-- B. Rastrear vendedor que registrou cada interação
ALTER TABLE public.interactions
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_interactions_user_id
  ON public.interactions(user_id)
  WHERE user_id IS NOT NULL;

-- C. Trigger: preenche user_id automaticamente via auth.uid()
CREATE OR REPLACE FUNCTION public.set_interaction_user_id()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_interaction_user_id() TO authenticated;

DROP TRIGGER IF EXISTS trg_interactions_user_id ON public.interactions;
CREATE TRIGGER trg_interactions_user_id
  BEFORE INSERT ON public.interactions
  FOR EACH ROW EXECUTE FUNCTION public.set_interaction_user_id();

-- D. Adiciona 'retorno' ao enum interaction_type para log correto no histórico
ALTER TYPE public.interaction_type ADD VALUE IF NOT EXISTS 'retorno';

-- E. Índice parcial para queries de follow-up (lte em next_return_at)
CREATE INDEX IF NOT EXISTS idx_customers_next_return
  ON public.customers(next_return_at)
  WHERE next_return_at IS NOT NULL;
