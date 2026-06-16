-- =============================================================
-- Fase 1: tenant_id defaults, responsavel_id e isolamento por perfil
-- Pré-requisito: Fase 0 (20260615000000_fase0_multitenant.sql)
-- =============================================================

-- ---------------------------------------------------------------
-- A. DEFAULT meu_tenant_id() em todas as tabelas CRM
--    Inserts do frontend não precisam enviar tenant_id explicitamente.
-- ---------------------------------------------------------------
ALTER TABLE public.customers    ALTER COLUMN tenant_id SET DEFAULT public.meu_tenant_id();
ALTER TABLE public.vehicles     ALTER COLUMN tenant_id SET DEFAULT public.meu_tenant_id();
ALTER TABLE public.appointments ALTER COLUMN tenant_id SET DEFAULT public.meu_tenant_id();
ALTER TABLE public.interactions ALTER COLUMN tenant_id SET DEFAULT public.meu_tenant_id();

-- ---------------------------------------------------------------
-- B. responsavel_id em customers
--    UUID nullable que identifica o vendedor responsável pelo lead.
-- ---------------------------------------------------------------
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS responsavel_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_customers_responsavel ON public.customers(responsavel_id);

-- ---------------------------------------------------------------
-- C. Trigger: auto-preenche responsavel_id = auth.uid() no INSERT
--    Se o campo vier preenchido (atribuição manual), respeita o valor.
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_responsavel_id()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.responsavel_id IS NULL THEN
    NEW.responsavel_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_customers_responsavel ON public.customers;
CREATE TRIGGER trg_customers_responsavel
  BEFORE INSERT ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_responsavel_id();

GRANT EXECUTE ON FUNCTION public.set_responsavel_id() TO authenticated;

-- ---------------------------------------------------------------
-- D. RLS customers — SELECT por perfil
--    Remove a política única (tenant_id = meu_tenant_id()) e substitui
--    por duas: uma para gerentes/admins (veem tudo do tenant),
--    outra para vendedores (veem só os próprios).
-- ---------------------------------------------------------------
DROP POLICY IF EXISTS "customers_tenant_select" ON public.customers;

CREATE POLICY "customers_gerente_admin_select" ON public.customers
  FOR SELECT USING (
    tenant_id = public.meu_tenant_id()
    AND public.meu_perfil_enum() IN ('admin_loja', 'gerente')
  );

CREATE POLICY "customers_vendedor_select" ON public.customers
  FOR SELECT USING (
    tenant_id = public.meu_tenant_id()
    AND public.meu_perfil_enum() = 'vendedor'
    AND responsavel_id = auth.uid()
  );

-- ---------------------------------------------------------------
-- D2. RLS customers — UPDATE por perfil
-- ---------------------------------------------------------------
DROP POLICY IF EXISTS "customers_tenant_update" ON public.customers;

CREATE POLICY "customers_gerente_admin_update" ON public.customers
  FOR UPDATE
  USING (
    tenant_id = public.meu_tenant_id()
    AND public.meu_perfil_enum() IN ('admin_loja', 'gerente')
  )
  WITH CHECK (
    tenant_id = public.meu_tenant_id()
    AND public.meu_perfil_enum() IN ('admin_loja', 'gerente')
  );

CREATE POLICY "customers_vendedor_update" ON public.customers
  FOR UPDATE
  USING (
    tenant_id = public.meu_tenant_id()
    AND public.meu_perfil_enum() = 'vendedor'
    AND responsavel_id = auth.uid()
  )
  WITH CHECK (
    tenant_id = public.meu_tenant_id()
    AND public.meu_perfil_enum() = 'vendedor'
    AND responsavel_id = auth.uid()
  );

-- ---------------------------------------------------------------
-- D3. RLS customers — DELETE por perfil
-- ---------------------------------------------------------------
DROP POLICY IF EXISTS "customers_tenant_delete" ON public.customers;

CREATE POLICY "customers_gerente_admin_delete" ON public.customers
  FOR DELETE USING (
    tenant_id = public.meu_tenant_id()
    AND public.meu_perfil_enum() IN ('admin_loja', 'gerente')
  );

CREATE POLICY "customers_vendedor_delete" ON public.customers
  FOR DELETE USING (
    tenant_id = public.meu_tenant_id()
    AND public.meu_perfil_enum() = 'vendedor'
    AND responsavel_id = auth.uid()
  );

-- ---------------------------------------------------------------
-- E. interactions INSERT: valida que o customer referenciado é
--    do mesmo tenant (evita referência cruzada de tenants).
-- ---------------------------------------------------------------
DROP POLICY IF EXISTS "interactions_tenant_insert" ON public.interactions;

CREATE POLICY "interactions_tenant_insert" ON public.interactions
  FOR INSERT WITH CHECK (
    tenant_id = public.meu_tenant_id()
    AND NOT public.is_super_admin()
    AND EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = customer_id
        AND c.tenant_id = public.meu_tenant_id()
    )
  );
