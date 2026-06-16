-- ============================================================
-- FASE 0: Sistema Multi-Tenant AutoFlow
-- ============================================================

-- Enums para o sistema multi-tenant
CREATE TYPE public.tenant_plano AS ENUM ('starter', 'pro', 'white_label');
CREATE TYPE public.tenant_status AS ENUM ('ativo', 'inativo', 'bloqueado');
CREATE TYPE public.user_perfil AS ENUM ('super_admin', 'admin_loja', 'gerente', 'vendedor');

-- ============================================================
-- TABELAS CORE DO MULTI-TENANT
-- ============================================================

-- Tabela de lojas (tenants)
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  email_admin TEXT NOT NULL,
  plano public.tenant_plano NOT NULL DEFAULT 'starter',
  status public.tenant_status NOT NULL DEFAULT 'ativo',
  logo_url TEXT,
  cor_primaria TEXT NOT NULL DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE ON public.tenants TO authenticated;
GRANT ALL ON public.tenants TO service_role;

-- Tabela de perfis de usuários
CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  perfil public.user_perfil NOT NULL DEFAULT 'vendedor',
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE ON public.user_profiles TO authenticated;
GRANT ALL ON public.user_profiles TO service_role;
CREATE INDEX idx_user_profiles_tenant ON public.user_profiles(tenant_id);
CREATE INDEX idx_user_profiles_auth ON public.user_profiles(id);

-- Tabela de super admins (acesso exclusivo CEO)
CREATE TABLE public.super_admins (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT SELECT ON public.super_admins TO authenticated;
GRANT ALL ON public.super_admins TO service_role;

-- ============================================================
-- ADICIONAR tenant_id ÀS TABELAS EXISTENTES
-- ============================================================

ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.vehicles  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.interactions ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

CREATE INDEX IF NOT EXISTS idx_customers_tenant    ON public.customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_tenant     ON public.vehicles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_appointments_tenant ON public.appointments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_interactions_tenant ON public.interactions(tenant_id);

-- ============================================================
-- FUNÇÕES AUXILIARES (SECURITY DEFINER para uso em políticas)
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.super_admins WHERE id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.meu_tenant_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.user_profiles
  WHERE id = auth.uid() AND ativo = TRUE
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.meu_perfil_enum()
RETURNS public.user_perfil
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT perfil FROM public.user_profiles
  WHERE id = auth.uid() AND ativo = TRUE
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.is_super_admin()     TO authenticated;
GRANT EXECUTE ON FUNCTION public.meu_tenant_id()      TO authenticated;
GRANT EXECUTE ON FUNCTION public.meu_perfil_enum()    TO authenticated;

-- ============================================================
-- RLS — TENANTS
-- ============================================================

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenants_super_admin_all"
  ON public.tenants FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "tenants_user_select_own"
  ON public.tenants FOR SELECT
  USING (id = public.meu_tenant_id());

-- ============================================================
-- RLS — USER_PROFILES
-- ============================================================

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_super_admin_all"
  ON public.user_profiles FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "profiles_user_select_own_tenant"
  ON public.user_profiles FOR SELECT
  USING (tenant_id = public.meu_tenant_id());

CREATE POLICY "profiles_admin_insert_own_tenant"
  ON public.user_profiles FOR INSERT
  WITH CHECK (
    tenant_id = public.meu_tenant_id()
    AND public.meu_perfil_enum() = 'admin_loja'
  );

CREATE POLICY "profiles_admin_update_own_tenant"
  ON public.user_profiles FOR UPDATE
  USING (tenant_id = public.meu_tenant_id() AND public.meu_perfil_enum() IN ('admin_loja', 'gerente'))
  WITH CHECK (tenant_id = public.meu_tenant_id() AND public.meu_perfil_enum() IN ('admin_loja', 'gerente'));

-- ============================================================
-- RLS — SUPER_ADMINS
-- ============================================================

ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admins_self_select"
  ON public.super_admins FOR SELECT
  USING (id = auth.uid() OR public.is_super_admin());

-- ============================================================
-- RLS — CUSTOMERS (substituir política permissiva)
-- ============================================================

DROP POLICY IF EXISTS "open_customers" ON public.customers;

CREATE POLICY "customers_super_admin_select"
  ON public.customers FOR SELECT
  USING (public.is_super_admin());

CREATE POLICY "customers_tenant_select"
  ON public.customers FOR SELECT
  USING (tenant_id = public.meu_tenant_id());

CREATE POLICY "customers_tenant_insert"
  ON public.customers FOR INSERT
  WITH CHECK (tenant_id = public.meu_tenant_id() AND NOT public.is_super_admin());

CREATE POLICY "customers_tenant_update"
  ON public.customers FOR UPDATE
  USING (tenant_id = public.meu_tenant_id())
  WITH CHECK (tenant_id = public.meu_tenant_id());

CREATE POLICY "customers_tenant_delete"
  ON public.customers FOR DELETE
  USING (
    tenant_id = public.meu_tenant_id()
    AND public.meu_perfil_enum() IN ('admin_loja', 'gerente')
  );

-- ============================================================
-- RLS — VEHICLES
-- ============================================================

DROP POLICY IF EXISTS "open_vehicles" ON public.vehicles;

CREATE POLICY "vehicles_super_admin_select"
  ON public.vehicles FOR SELECT
  USING (public.is_super_admin());

CREATE POLICY "vehicles_tenant_select"
  ON public.vehicles FOR SELECT
  USING (tenant_id = public.meu_tenant_id());

CREATE POLICY "vehicles_tenant_insert"
  ON public.vehicles FOR INSERT
  WITH CHECK (tenant_id = public.meu_tenant_id() AND NOT public.is_super_admin());

CREATE POLICY "vehicles_tenant_update"
  ON public.vehicles FOR UPDATE
  USING (tenant_id = public.meu_tenant_id())
  WITH CHECK (tenant_id = public.meu_tenant_id());

CREATE POLICY "vehicles_tenant_delete"
  ON public.vehicles FOR DELETE
  USING (
    tenant_id = public.meu_tenant_id()
    AND public.meu_perfil_enum() IN ('admin_loja', 'gerente')
  );

-- ============================================================
-- RLS — INTERACTIONS
-- ============================================================

DROP POLICY IF EXISTS "open_interactions" ON public.interactions;

CREATE POLICY "interactions_super_admin_select"
  ON public.interactions FOR SELECT
  USING (public.is_super_admin());

CREATE POLICY "interactions_tenant_select"
  ON public.interactions FOR SELECT
  USING (tenant_id = public.meu_tenant_id());

CREATE POLICY "interactions_tenant_insert"
  ON public.interactions FOR INSERT
  WITH CHECK (tenant_id = public.meu_tenant_id() AND NOT public.is_super_admin());

CREATE POLICY "interactions_tenant_update"
  ON public.interactions FOR UPDATE
  USING (tenant_id = public.meu_tenant_id())
  WITH CHECK (tenant_id = public.meu_tenant_id());

CREATE POLICY "interactions_tenant_delete"
  ON public.interactions FOR DELETE
  USING (tenant_id = public.meu_tenant_id());

-- ============================================================
-- RLS — APPOINTMENTS
-- ============================================================

DROP POLICY IF EXISTS "open_appointments" ON public.appointments;

CREATE POLICY "appointments_super_admin_select"
  ON public.appointments FOR SELECT
  USING (public.is_super_admin());

CREATE POLICY "appointments_tenant_select"
  ON public.appointments FOR SELECT
  USING (tenant_id = public.meu_tenant_id());

CREATE POLICY "appointments_tenant_insert"
  ON public.appointments FOR INSERT
  WITH CHECK (tenant_id = public.meu_tenant_id() AND NOT public.is_super_admin());

CREATE POLICY "appointments_tenant_update"
  ON public.appointments FOR UPDATE
  USING (tenant_id = public.meu_tenant_id())
  WITH CHECK (tenant_id = public.meu_tenant_id());

CREATE POLICY "appointments_tenant_delete"
  ON public.appointments FOR DELETE
  USING (tenant_id = public.meu_tenant_id());

-- ============================================================
-- FUNÇÕES DE NEGÓCIO
-- ============================================================

-- get_meu_perfil(): retorna perfil completo do usuário logado
CREATE OR REPLACE FUNCTION public.get_meu_perfil()
RETURNS TABLE(
  perfil        TEXT,
  tenant_id     UUID,
  plano         TEXT,
  tenant_status TEXT,
  nome          TEXT,
  email         TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.super_admins WHERE id = auth.uid()) THEN
    RETURN QUERY
      SELECT
        'super_admin'::TEXT,
        NULL::UUID,
        NULL::TEXT,
        NULL::TEXT,
        sa.nome,
        sa.email
      FROM public.super_admins sa
      WHERE sa.id = auth.uid();
  ELSE
    RETURN QUERY
      SELECT
        up.perfil::TEXT,
        up.tenant_id,
        t.plano::TEXT,
        t.status::TEXT,
        up.nome,
        up.email
      FROM public.user_profiles up
      JOIN public.tenants t ON t.id = up.tenant_id
      WHERE up.id = auth.uid() AND up.ativo = TRUE
      LIMIT 1;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_meu_perfil() TO authenticated;

-- criar_tenant(): cria nova loja (apenas super_admin)
CREATE OR REPLACE FUNCTION public.criar_tenant(
  p_nome         TEXT,
  p_email_admin  TEXT,
  p_plano        public.tenant_plano DEFAULT 'starter',
  p_logo_url     TEXT DEFAULT NULL,
  p_cor_primaria TEXT DEFAULT '#3b82f6'
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Acesso negado: apenas super admins podem criar lojas';
  END IF;

  INSERT INTO public.tenants (nome, email_admin, plano, status, logo_url, cor_primaria)
  VALUES (p_nome, p_email_admin, p_plano, 'ativo', p_logo_url, p_cor_primaria)
  RETURNING id INTO v_tenant_id;

  RETURN v_tenant_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.criar_tenant(TEXT, TEXT, public.tenant_plano, TEXT, TEXT) TO authenticated;
