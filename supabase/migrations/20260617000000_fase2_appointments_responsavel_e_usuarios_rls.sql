-- ================================================================
-- Fase 2: responsavel_id em appointments + RLS split por perfil
--         + gerente pode inserir user_profiles
-- ================================================================

-- A. responsavel_id em appointments (mesmo padrão de customers)
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS responsavel_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_responsavel ON public.appointments(responsavel_id);

CREATE OR REPLACE FUNCTION public.set_appointments_responsavel_id()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.responsavel_id IS NULL THEN
    NEW.responsavel_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_appointments_responsavel_id() TO authenticated;

DROP TRIGGER IF EXISTS trg_appointments_responsavel ON public.appointments;
CREATE TRIGGER trg_appointments_responsavel
  BEFORE INSERT ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_appointments_responsavel_id();

-- B. Split RLS em appointments: admin/gerente vs vendedor
DROP POLICY IF EXISTS "appointments_tenant_select" ON public.appointments;
DROP POLICY IF EXISTS "appointments_tenant_update" ON public.appointments;
DROP POLICY IF EXISTS "appointments_tenant_delete" ON public.appointments;

-- SELECT
CREATE POLICY "appointments_gerente_admin_select" ON public.appointments
  FOR SELECT USING (
    tenant_id = public.meu_tenant_id()
    AND public.meu_perfil_enum() IN ('admin_loja', 'gerente')
  );

CREATE POLICY "appointments_vendedor_select" ON public.appointments
  FOR SELECT USING (
    tenant_id = public.meu_tenant_id()
    AND public.meu_perfil_enum() = 'vendedor'
    AND responsavel_id = auth.uid()
  );

-- UPDATE
CREATE POLICY "appointments_gerente_admin_update" ON public.appointments
  FOR UPDATE
  USING (
    tenant_id = public.meu_tenant_id()
    AND public.meu_perfil_enum() IN ('admin_loja', 'gerente')
  )
  WITH CHECK (
    tenant_id = public.meu_tenant_id()
    AND public.meu_perfil_enum() IN ('admin_loja', 'gerente')
  );

CREATE POLICY "appointments_vendedor_update" ON public.appointments
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

-- DELETE
CREATE POLICY "appointments_gerente_admin_delete" ON public.appointments
  FOR DELETE USING (
    tenant_id = public.meu_tenant_id()
    AND public.meu_perfil_enum() IN ('admin_loja', 'gerente')
  );

CREATE POLICY "appointments_vendedor_delete" ON public.appointments
  FOR DELETE USING (
    tenant_id = public.meu_tenant_id()
    AND public.meu_perfil_enum() = 'vendedor'
    AND responsavel_id = auth.uid()
  );

-- C. user_profiles INSERT: estender para gerente
DROP POLICY IF EXISTS "profiles_admin_insert_own_tenant" ON public.user_profiles;

CREATE POLICY "profiles_admin_gerente_insert_own_tenant"
  ON public.user_profiles FOR INSERT
  WITH CHECK (
    tenant_id = public.meu_tenant_id()
    AND public.meu_perfil_enum() IN ('admin_loja', 'gerente')
  );
