-- ============================================================
-- Lead Engine v2
-- ============================================================
-- 1. Tabela notifications (central de notificações interna)
-- 2. Campos de atribuição de campanha em customers
-- 3. Policy UPDATE para admin_loja nos próprios dados do tenant
-- ============================================================

-- ============================================================
-- 1. Campos de atribuição de campanha em customers
-- ============================================================
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS source_campaign_id   TEXT,
  ADD COLUMN IF NOT EXISTS source_campaign_name TEXT,
  ADD COLUMN IF NOT EXISTS source_adset_id      TEXT,
  ADD COLUMN IF NOT EXISTS source_adset_name    TEXT,
  ADD COLUMN IF NOT EXISTS source_ad_id         TEXT,
  ADD COLUMN IF NOT EXISTS source_ad_name       TEXT;

-- ============================================================
-- 2. notifications
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  type        TEXT        NOT NULL DEFAULT 'info',
  -- tipos: 'novo_lead' | 'lead_duplicado' | 'integracao_erro' | 'sistema'
  title       TEXT        NOT NULL,
  body        TEXT,
  metadata    JSONB       DEFAULT '{}',
  -- metadata: { customer_id, platform, source_platform, campaign_name, ad_name, ... }
  read        BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_tenant_unread
  ON public.notifications (tenant_id, read, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notif_super_admin_all"   ON public.notifications;
DROP POLICY IF EXISTS "notif_tenant_select"      ON public.notifications;
DROP POLICY IF EXISTS "notif_tenant_update"      ON public.notifications;

-- Super admin vê e grava tudo
CREATE POLICY "notif_super_admin_all"
  ON public.notifications FOR ALL
  USING (public.is_super_admin());

-- Todos os usuários autenticados veem as notificações do seu tenant
CREATE POLICY "notif_tenant_select"
  ON public.notifications FOR SELECT
  USING (tenant_id = public.meu_tenant_id());

-- Usuários podem marcar como lido (UPDATE)
CREATE POLICY "notif_tenant_update"
  ON public.notifications FOR UPDATE
  USING (tenant_id = public.meu_tenant_id())
  WITH CHECK (tenant_id = public.meu_tenant_id());

-- ============================================================
-- 3. Policy UPDATE para admin_loja editar dados básicos do tenant
-- (apenas nome e visual — status/plano continuam restritos ao super_admin)
-- ============================================================
DROP POLICY IF EXISTS "tenants_admin_update_own" ON public.tenants;

CREATE POLICY "tenants_admin_update_own"
  ON public.tenants FOR UPDATE
  USING (
    id = public.meu_tenant_id()
    AND public.meu_perfil_enum() = 'admin_loja'
  )
  WITH CHECK (
    id = public.meu_tenant_id()
    AND public.meu_perfil_enum() = 'admin_loja'
    -- plano e status só podem ser alterados via super_admin (garantido pela ausência de política INSERT)
  );
