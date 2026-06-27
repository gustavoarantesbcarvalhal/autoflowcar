-- ============================================================
-- Lead Engine v1 — Central de Captura de Leads
-- ============================================================
-- Inclui:
--   1. Função normalize_phone
--   2. Novos campos em customers (source_platform, source_campaign, source_raw)
--   3. Tabela tenant_integrations (config por tenant/plataforma)
--   4. Tabela webhook_events_log (auditoria + deduplicação de eventos)
--   5. Tabela lead_dedup_index (deduplicação de leads por phone/email)
--   6. RLS em todas as novas tabelas
-- ============================================================

-- 1. normalize_phone
-- Remove +55, espaços, traços e parênteses → apenas dígitos
CREATE OR REPLACE FUNCTION public.normalize_phone(p TEXT)
RETURNS TEXT AS $$
  SELECT regexp_replace(
    regexp_replace(COALESCE(p, ''), '^\+?55', ''),
    '[^0-9]', '', 'g'
  );
$$ LANGUAGE SQL IMMUTABLE;

-- Função genérica para updated_at (reutilizável)
CREATE OR REPLACE FUNCTION public.trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 2. Novos campos em customers
-- ============================================================
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS source_platform  TEXT,
  ADD COLUMN IF NOT EXISTS source_campaign  TEXT,
  ADD COLUMN IF NOT EXISTS source_raw       JSONB;

-- ============================================================
-- 3. tenant_integrations
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tenant_integrations (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  platform              TEXT        NOT NULL,
  status                TEXT        NOT NULL DEFAULT 'inativo'
                          CHECK (status IN ('ativo', 'inativo', 'erro')),

  -- Meta Lead Ads / Click-to-WhatsApp
  fb_page_id            TEXT,
  fb_page_access_token  TEXT,       -- protegido por RLS + HTTPS

  -- WhatsApp Business API (Cloud)
  waba_phone_number_id  TEXT,       -- identifica o tenant no webhook
  wa_api_token          TEXT,       -- protegido por RLS + HTTPS

  -- Generic webhook (site, landing pages, API própria)
  webhook_verify_token  TEXT        NOT NULL DEFAULT gen_random_uuid()::TEXT,

  -- Metadados
  config                JSONB       DEFAULT '{}',
  last_sync_at          TIMESTAMPTZ,
  last_error            TEXT,
  last_error_at         TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (tenant_id, platform)
);

-- Índices para lookup rápido nos webhooks (O(log n) mesmo com 20k tenants)
CREATE INDEX IF NOT EXISTS idx_ti_fb_page_id
  ON public.tenant_integrations (fb_page_id)
  WHERE fb_page_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ti_waba_phone
  ON public.tenant_integrations (waba_phone_number_id)
  WHERE waba_phone_number_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ti_verify_token
  ON public.tenant_integrations (webhook_verify_token);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_tenant_integrations_updated ON public.tenant_integrations;
CREATE TRIGGER trg_tenant_integrations_updated
  BEFORE UPDATE ON public.tenant_integrations
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- RLS
ALTER TABLE public.tenant_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ti_super_admin_all"          ON public.tenant_integrations;
DROP POLICY IF EXISTS "ti_admin_gerente_select"      ON public.tenant_integrations;
DROP POLICY IF EXISTS "ti_admin_insert"              ON public.tenant_integrations;
DROP POLICY IF EXISTS "ti_admin_update"              ON public.tenant_integrations;
DROP POLICY IF EXISTS "ti_admin_delete"              ON public.tenant_integrations;

CREATE POLICY "ti_super_admin_all"
  ON public.tenant_integrations FOR ALL
  USING (public.is_super_admin());

CREATE POLICY "ti_admin_gerente_select"
  ON public.tenant_integrations FOR SELECT
  USING (
    tenant_id = public.meu_tenant_id()
    AND public.meu_perfil_enum() IN ('admin_loja', 'gerente')
  );

CREATE POLICY "ti_admin_insert"
  ON public.tenant_integrations FOR INSERT
  WITH CHECK (
    tenant_id = public.meu_tenant_id()
    AND public.meu_perfil_enum() = 'admin_loja'
  );

CREATE POLICY "ti_admin_update"
  ON public.tenant_integrations FOR UPDATE
  USING (
    tenant_id = public.meu_tenant_id()
    AND public.meu_perfil_enum() = 'admin_loja'
  );

CREATE POLICY "ti_admin_delete"
  ON public.tenant_integrations FOR DELETE
  USING (
    tenant_id = public.meu_tenant_id()
    AND public.meu_perfil_enum() = 'admin_loja'
  );

-- ============================================================
-- 4. webhook_events_log
-- ============================================================
CREATE TABLE IF NOT EXISTS public.webhook_events_log (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID        REFERENCES public.tenants(id) ON DELETE SET NULL,
  platform             TEXT        NOT NULL,
  payload_hash         TEXT        NOT NULL,
  status               TEXT        NOT NULL DEFAULT 'received'
                         CHECK (status IN ('received', 'processed', 'duplicated', 'error')),
  error_message        TEXT,
  created_customer_id  UUID        REFERENCES public.customers(id) ON DELETE SET NULL,
  raw_payload          JSONB,
  processed_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wel_hash
  ON public.webhook_events_log (payload_hash);

CREATE INDEX IF NOT EXISTS idx_wel_tenant_date
  ON public.webhook_events_log (tenant_id, created_at DESC);

ALTER TABLE public.webhook_events_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wel_super_admin_all"         ON public.webhook_events_log;
DROP POLICY IF EXISTS "wel_admin_gerente_select"     ON public.webhook_events_log;

CREATE POLICY "wel_super_admin_all"
  ON public.webhook_events_log FOR ALL
  USING (public.is_super_admin());

CREATE POLICY "wel_admin_gerente_select"
  ON public.webhook_events_log FOR SELECT
  USING (
    tenant_id = public.meu_tenant_id()
    AND public.meu_perfil_enum() IN ('admin_loja', 'gerente')
  );

-- ============================================================
-- 5. lead_dedup_index
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lead_dedup_index (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id       UUID        NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  normalized_phone  TEXT,
  email_lower       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices parciais únicos (seguro em PG 14+, supabase usa PG 15)
CREATE UNIQUE INDEX IF NOT EXISTS idx_dedup_phone
  ON public.lead_dedup_index (tenant_id, normalized_phone)
  WHERE normalized_phone IS NOT NULL AND normalized_phone <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_dedup_email
  ON public.lead_dedup_index (tenant_id, email_lower)
  WHERE email_lower IS NOT NULL AND email_lower <> '';

ALTER TABLE public.lead_dedup_index ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dedup_super_admin_all"         ON public.lead_dedup_index;
DROP POLICY IF EXISTS "dedup_admin_gerente_select"     ON public.lead_dedup_index;

CREATE POLICY "dedup_super_admin_all"
  ON public.lead_dedup_index FOR ALL
  USING (public.is_super_admin());

CREATE POLICY "dedup_admin_gerente_select"
  ON public.lead_dedup_index FOR SELECT
  USING (
    tenant_id = public.meu_tenant_id()
    AND public.meu_perfil_enum() IN ('admin_loja', 'gerente')
  );

-- ============================================================
-- Backfill do lead_dedup_index com leads existentes
-- ============================================================
INSERT INTO public.lead_dedup_index (tenant_id, customer_id, normalized_phone, email_lower)
SELECT
  c.tenant_id,
  c.id,
  NULLIF(public.normalize_phone(COALESCE(c.whatsapp, c.phone)), '') AS normalized_phone,
  NULLIF(LOWER(TRIM(c.email)), '')                                   AS email_lower
FROM public.customers c
WHERE c.tenant_id IS NOT NULL
ON CONFLICT DO NOTHING;
