-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'financeiro', 'comercial', 'operacao', 'gestao', 'bi_viewer');
CREATE TYPE public.devis_status AS ENUM ('rascunho', 'enviado', 'aprovado', 'rejeitado', 'convertido');
CREATE TYPE public.service_status AS ENUM ('pendente', 'em_andamento', 'concluido', 'cancelado');
CREATE TYPE public.conciliation_status AS ENUM ('pendente', 'conciliado', 'divergente', 'ignorado');
CREATE TYPE public.match_type AS ENUM ('automatico', 'manual');
CREATE TYPE public.match_status AS ENUM ('sugerido', 'confirmado', 'rejeitado');
CREATE TYPE public.entry_type AS ENUM ('receita', 'despesa', 'transferencia');
CREATE TYPE public.source_type AS ENUM ('manual', 'importacao_planilha', 'importacao_extrato', 'sistema');
CREATE TYPE public.import_status AS ENUM ('processando', 'concluido', 'erro', 'parcial');

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT, email TEXT, avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete profiles" ON public.profiles FOR DELETE USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert profiles" ON public.profiles FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update profiles" ON public.profiles FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.business_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, code TEXT UNIQUE, description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.business_units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view business_units" ON public.business_units FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage business_units" ON public.business_units FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_business_units_updated_at BEFORE UPDATE ON public.business_units FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_unit_id UUID REFERENCES public.business_units(id),
  bank_name TEXT NOT NULL, account_number TEXT, agency TEXT, account_type TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view bank_accounts" ON public.bank_accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and financeiro can manage bank_accounts" ON public.bank_accounts FOR ALL USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'financeiro'));
CREATE TRIGGER update_bank_accounts_updated_at BEFORE UPDATE ON public.bank_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL, source_kind TEXT NOT NULL,
  row_count INTEGER DEFAULT 0, success_count INTEGER DEFAULT 0, error_count INTEGER DEFAULT 0,
  status import_status NOT NULL DEFAULT 'processando',
  error_log JSONB, imported_by UUID REFERENCES auth.users(id),
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view import_batches" ON public.import_batches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and financeiro can manage import_batches" ON public.import_batches FOR ALL USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'financeiro'));

CREATE TABLE public.financial_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date DATE NOT NULL, competence_month TEXT, business_unit TEXT,
  movement_account TEXT, movement_description TEXT, counterparty_name TEXT,
  amount_in NUMERIC(15,2) DEFAULT 0, amount_out NUMERIC(15,2) DEFAULT 0,
  amount_signed NUMERIC(15,2) GENERATED ALWAYS AS (COALESCE(amount_in, 0) - COALESCE(amount_out, 0)) STORED,
  entry_type entry_type, source_type source_type NOT NULL DEFAULT 'manual',
  source_file_name TEXT, source_sheet_name TEXT,
  bank_account_id UUID REFERENCES public.bank_accounts(id),
  conciliation_status conciliation_status NOT NULL DEFAULT 'pendente',
  conciliation_group_id UUID, document_reference TEXT,
  import_batch_id UUID REFERENCES public.import_batches(id),
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.financial_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view financial_entries" ON public.financial_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and financeiro can manage financial_entries" ON public.financial_entries FOR ALL USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'financeiro'));
CREATE TRIGGER update_financial_entries_updated_at BEFORE UPDATE ON public.financial_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_financial_entries_date ON public.financial_entries(entry_date);
CREATE INDEX idx_financial_entries_competence ON public.financial_entries(competence_month);
CREATE INDEX idx_financial_entries_business ON public.financial_entries(business_unit);
CREATE INDEX idx_financial_entries_conciliation ON public.financial_entries(conciliation_status);

CREATE TABLE public.bank_statement_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id UUID REFERENCES public.bank_accounts(id),
  transaction_date DATE NOT NULL, description TEXT, document_number TEXT,
  amount NUMERIC(15,2) NOT NULL,
  direction TEXT CHECK (direction IN ('entrada', 'saida')),
  raw_payload JSONB, import_batch_id UUID REFERENCES public.import_batches(id),
  suggested_match_id UUID,
  conciliation_status conciliation_status NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bank_statement_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view bank_statement_entries" ON public.bank_statement_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and financeiro can manage bank_statement_entries" ON public.bank_statement_entries FOR ALL USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'financeiro'));
CREATE INDEX idx_bank_statement_date ON public.bank_statement_entries(transaction_date);
CREATE INDEX idx_bank_statement_status ON public.bank_statement_entries(conciliation_status);

CREATE TABLE public.conciliation_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_statement_entry_id UUID NOT NULL REFERENCES public.bank_statement_entries(id),
  financial_entry_id UUID NOT NULL REFERENCES public.financial_entries(id),
  match_score NUMERIC(5,2),
  match_type match_type NOT NULL DEFAULT 'automatico',
  status match_status NOT NULL DEFAULT 'sugerido',
  confirmed_by UUID REFERENCES auth.users(id),
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.conciliation_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view conciliation_matches" ON public.conciliation_matches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and financeiro can manage conciliation_matches" ON public.conciliation_matches FOR ALL USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'financeiro'));

CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, email TEXT, phone TEXT, document TEXT,
  address TEXT, city TEXT, notes TEXT,
  type TEXT NOT NULL DEFAULT 'PJ',
  business_unit_id UUID REFERENCES public.business_units(id),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view clients" ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and comercial can manage clients" ON public.clients FOR ALL USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'comercial'));
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.devis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number TEXT,
  client_id UUID REFERENCES public.clients(id),
  title TEXT NOT NULL, description TEXT,
  total_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  status devis_status NOT NULL DEFAULT 'rascunho',
  business_unit TEXT, approved_at TIMESTAMPTZ,
  initial_charge_generated BOOLEAN DEFAULT false,
  final_charge_generated BOOLEAN DEFAULT false,
  meeting_date DATE, commercial_responsible UUID,
  meeting_summary TEXT, meeting_report TEXT,
  service_type TEXT, responsible_sector TEXT,
  scope_description TEXT, proposal_structure TEXT,
  down_payment_amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  validation_client_confirmed BOOLEAN NOT NULL DEFAULT false,
  validation_service_confirmed BOOLEAN NOT NULL DEFAULT false,
  validation_sector_defined BOOLEAN NOT NULL DEFAULT false,
  validation_amount_confirmed BOOLEAN NOT NULL DEFAULT false,
  validation_deadline_defined BOOLEAN NOT NULL DEFAULT false,
  validated_at TIMESTAMPTZ, validated_by UUID,
  deadline_date DATE,
  accept_token UUID NOT NULL DEFAULT gen_random_uuid(),
  accepted_at TIMESTAMPTZ, accepted_ip TEXT, sent_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX devis_accept_token_key ON public.devis(accept_token);
ALTER TABLE public.devis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view devis" ON public.devis FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and comercial can manage devis" ON public.devis FOR ALL USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'comercial'));
CREATE TRIGGER update_devis_updated_at BEFORE UPDATE ON public.devis FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.calc_devis_down_payment()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.down_payment_amount IS NULL OR NEW.down_payment_amount = 0 THEN
      NEW.down_payment_amount := COALESCE(NEW.total_amount, 0) * 0.5;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.total_amount IS DISTINCT FROM OLD.total_amount
       AND NEW.down_payment_amount IS NOT DISTINCT FROM OLD.down_payment_amount THEN
      NEW.down_payment_amount := COALESCE(NEW.total_amount, 0) * 0.5;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_calc_devis_down_payment BEFORE INSERT OR UPDATE ON public.devis FOR EACH ROW EXECUTE FUNCTION public.calc_devis_down_payment();

CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  devis_id UUID REFERENCES public.devis(id),
  client_id UUID REFERENCES public.clients(id),
  title TEXT NOT NULL, description TEXT,
  status service_status NOT NULL DEFAULT 'pendente',
  start_date DATE, expected_end_date DATE, actual_end_date DATE,
  business_unit TEXT, responsible_sector TEXT,
  final_charge_generated BOOLEAN DEFAULT false,
  assigned_to UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX services_devis_id_unique ON public.services(devis_id) WHERE devis_id IS NOT NULL;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view services" ON public.services FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and operacao can manage services" ON public.services FOR ALL USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operacao'));
CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL, entity_type TEXT, entity_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view audit_logs" ON public.audit_logs FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated users can insert audit_logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'gerencial';
ALTER TYPE public.devis_status ADD VALUE IF NOT EXISTS 'reuniao_realizada';
ALTER TYPE public.devis_status ADD VALUE IF NOT EXISTS 'proposta_em_geracao';
ALTER TYPE public.devis_status ADD VALUE IF NOT EXISTS 'aguardando_validacao';
ALTER TYPE public.devis_status ADD VALUE IF NOT EXISTS 'pronta_para_envio';
ALTER TYPE public.devis_status ADD VALUE IF NOT EXISTS 'enviada_ao_cliente';
ALTER TYPE public.devis_status ADD VALUE IF NOT EXISTS 'aguardando_aceite';
ALTER TYPE public.devis_status ADD VALUE IF NOT EXISTS 'aceita';
ALTER TYPE public.devis_status ADD VALUE IF NOT EXISTS 'rejeitada';
ALTER TYPE public.devis_status ADD VALUE IF NOT EXISTS 'cobranca_pendente';
ALTER TYPE public.devis_status ADD VALUE IF NOT EXISTS 'entrada_recebida';
ALTER TYPE public.devis_status ADD VALUE IF NOT EXISTS 'enviado_para_operacao';
ALTER TYPE public.service_status ADD VALUE IF NOT EXISTS 'a_iniciar';