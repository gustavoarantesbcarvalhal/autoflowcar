
-- Enums
CREATE TYPE public.lead_status AS ENUM (
  'novo_lead','primeiro_contato','interessado','em_negociacao',
  'test_drive','proposta_enviada','venda_realizada','perdido'
);
CREATE TYPE public.lead_source AS ENUM (
  'instagram','facebook','marketplace','olx','site','indicacao','outros'
);
CREATE TYPE public.vehicle_status AS ENUM ('disponivel','reservado','vendido');
CREATE TYPE public.interaction_type AS ENUM (
  'nota','ligacao','whatsapp','email','visita','test_drive','proposta','veiculo_apresentado','perda'
);
CREATE TYPE public.appointment_type AS ENUM ('retorno','visita','test_drive');

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Customers
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  whatsapp TEXT,
  city TEXT,
  email TEXT,
  interest_brand TEXT,
  interest_model TEXT,
  interest_year TEXT,
  price_min NUMERIC,
  price_max NUMERIC,
  notes TEXT,
  source public.lead_source DEFAULT 'outros',
  status public.lead_status NOT NULL DEFAULT 'novo_lead',
  last_contact_at TIMESTAMPTZ DEFAULT now(),
  next_return_at TIMESTAMPTZ,
  lost_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO anon, authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open_customers" ON public.customers FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_customers_updated BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Vehicles
CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  year INT,
  color TEXT,
  mileage INT,
  price NUMERIC,
  status public.vehicle_status NOT NULL DEFAULT 'disponivel',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles TO anon, authenticated;
GRANT ALL ON public.vehicles TO service_role;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open_vehicles" ON public.vehicles FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_vehicles_updated BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Interactions
CREATE TABLE public.interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  type public.interaction_type NOT NULL DEFAULT 'nota',
  content TEXT,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interactions TO anon, authenticated;
GRANT ALL ON public.interactions TO service_role;
ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open_interactions" ON public.interactions FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_interactions_customer ON public.interactions(customer_id, created_at DESC);

-- Appointments
CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  type public.appointment_type NOT NULL DEFAULT 'retorno',
  scheduled_at TIMESTAMPTZ NOT NULL,
  title TEXT,
  notes TEXT,
  done BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO anon, authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open_appointments" ON public.appointments FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_appointments_scheduled ON public.appointments(scheduled_at);
