-- ================================================================
-- Fase 3.5: Follow-up Profissional
-- Prioridade de leads + rastreio de tempo em etapa
-- ================================================================

-- A. Marcar lead como prioritário (estrela na Central de Follow-up)
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS is_priority      BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ DEFAULT NULL;

-- B. Função: registra o momento em que o status muda de etapa
CREATE OR REPLACE FUNCTION public.set_status_changed_at()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public AS $$
BEGIN
  IF NEW.status <> OLD.status THEN
    NEW.status_changed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_status_changed_at() TO authenticated;

-- C. Trigger: dispara APENAS em UPDATE de status (não em todo UPDATE do registro)
DROP TRIGGER IF EXISTS trg_customers_status_changed ON public.customers;
CREATE TRIGGER trg_customers_status_changed
  BEFORE UPDATE OF status ON public.customers
  FOR EACH ROW EXECUTE FUNCTION set_status_changed_at();

-- D. Índice parcial: leads prioritários — filtra só os marcados (minoria)
CREATE INDEX IF NOT EXISTS idx_customers_priority
  ON public.customers(is_priority, next_return_at)
  WHERE is_priority = true;

-- E. Índice parcial: leads ativos por tempo em etapa
--    Exclui venda_realizada e perdido — nunca entram no cálculo de "parados"
CREATE INDEX IF NOT EXISTS idx_customers_status_changed
  ON public.customers(status_changed_at)
  WHERE status NOT IN ('venda_realizada', 'perdido');
