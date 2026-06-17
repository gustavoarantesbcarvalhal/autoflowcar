-- ================================================================
-- Fase 3.6.1: Auditoria de lojas
-- ================================================================

-- A. Campos de auditoria em tenants
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS created_by_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS archived_at    TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS archived_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS blocked_at     TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS blocked_by_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- B. Log permanente de ações (sobrevive à exclusão do tenant)
CREATE TABLE IF NOT EXISTS public.tenant_actions_log (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID,
  tenant_nome    TEXT        NOT NULL,
  acao           TEXT        NOT NULL,
  feito_por_id   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  feito_por_nome TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- C. RLS: apenas super_admin lê e escreve o log
ALTER TABLE public.tenant_actions_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "log_super_admin_select" ON public.tenant_actions_log
  FOR SELECT USING (public.is_super_admin());

CREATE POLICY "log_super_admin_insert" ON public.tenant_actions_log
  FOR INSERT WITH CHECK (public.is_super_admin());

-- D. Índice para filtros rápidos por status no painel
CREATE INDEX IF NOT EXISTS idx_tenants_status
  ON public.tenants(status);
