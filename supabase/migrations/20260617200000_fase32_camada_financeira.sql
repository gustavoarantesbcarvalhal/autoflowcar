-- Fase 3.2: Camada Financeira — sold_at + sale_value
-- Campos nullable, zero impacto nos dados existentes do cliente piloto

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS sold_at    TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sale_value NUMERIC     DEFAULT NULL;

-- Trigger: auto-registra sold_at quando status muda para venda_realizada.
-- COALESCE preserva valor explícito (venda retroativa). Reversão de status não apaga sold_at.
CREATE OR REPLACE FUNCTION public.set_sold_at()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public AS $$
BEGIN
  IF NEW.status = 'venda_realizada' AND OLD.status <> 'venda_realizada' THEN
    NEW.sold_at := COALESCE(NEW.sold_at, now());
  END IF;
  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_sold_at() TO authenticated;

DROP TRIGGER IF EXISTS trg_customers_sold_at ON public.customers;
CREATE TRIGGER trg_customers_sold_at
  BEFORE UPDATE OF status ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_sold_at();

-- Backfill: preenche sold_at com updated_at para vendas já existentes.
-- No cliente piloto há 0 registros venda_realizada — executa sem efeito.
UPDATE public.customers
SET    sold_at = updated_at
WHERE  status = 'venda_realizada'
  AND  sold_at IS NULL;

-- Índices para queries de dashboard financeiro
CREATE INDEX IF NOT EXISTS idx_customers_sold_at
  ON public.customers(sold_at)
  WHERE sold_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customers_created_at
  ON public.customers(created_at);

CREATE INDEX IF NOT EXISTS idx_customers_responsavel_sold
  ON public.customers(responsavel_id, sold_at)
  WHERE status = 'venda_realizada';
