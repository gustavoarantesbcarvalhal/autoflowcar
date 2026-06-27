-- ================================================================
-- Fase 5: Pipeline Simplificado + Edição Completa de Leads
-- ================================================================

-- A. Novos valores no enum lead_status (6 estágios)
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'em_atendimento';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'visita';

-- B. Novo tipo de interação para log de edições (aparece no timeline)
ALTER TYPE public.interaction_type ADD VALUE IF NOT EXISTS 'edicao';

-- C. Campo CPF nos leads (nullable, zero impacto nos 6 leads existentes)
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS cpf TEXT DEFAULT NULL;

-- D. Migração de dados: novo_lead → primeiro_contato (2 leads no piloto)
--    novo_lead é absorvido por primeiro_contato no pipeline simplificado
UPDATE public.customers
SET status = 'primeiro_contato'
WHERE status = 'novo_lead';
