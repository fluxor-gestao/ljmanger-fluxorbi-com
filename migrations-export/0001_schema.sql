-- =====================================================================
-- 0001_schema.sql  —  ARTEFATO (NÃO aplicar via Lovable)
-- Destino: projeto Supabase Pro uxwdzcjhrhlugrjgpkcr
-- Aplicar manualmente:
--   psql "$NEW_SUPABASE_DB_URL" -f migrations-export/0001_schema.sql
--
-- Pré-requisitos no destino:
--   Extensões habilitadas no Dashboard → Database → Extensions:
--     pgcrypto, uuid-ossp, pg_net, pgmq, pg_cron
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pgmq;
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE SCHEMA IF NOT EXISTS app_private;

-- ---------- Enums ----------
DO $$ BEGIN CREATE TYPE public.app_role AS ENUM
  ('admin','financeiro','comercial','operacao','gestao','bi_viewer','gerencial');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.devis_status AS ENUM
  ('rascunho','enviado','aprovado','rejeitado','convertido','reuniao_realizada',
   'proposta_em_geracao','aguardando_validacao','pronta_para_envio','enviada_ao_cliente',
   'aguardando_aceite','aceita','rejeitada','cobranca_pendente','entrada_recebida',
   'enviado_para_operacao');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.service_status AS ENUM
  ('pendente','em_andamento','concluido','cancelado','a_iniciar');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.conciliation_status AS ENUM
  ('pendente','conciliado','divergente','ignorado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.entry_type AS ENUM ('receita','despesa','transferencia');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.source_type AS ENUM
  ('manual','importacao_planilha','importacao_extrato','sistema');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.import_status AS ENUM ('processando','concluido','erro','parcial');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.match_status AS ENUM ('sugerido','confirmado','rejeitado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.match_type AS ENUM ('automatico','manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- Tabelas + GRANTs ----------
CREATE TABLE IF NOT EXISTS public.business_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE, name text NOT NULL, description text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT,INSERT,UPDATE,DELETE ON public.business_units TO authenticated;
GRANT ALL ON public.business_units TO service_role;

CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_unit_id uuid REFERENCES public.business_units(id),
  bank_name text NOT NULL, account_number text, agency text, account_type text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT,INSERT,UPDATE,DELETE ON public.bank_accounts TO authenticated;
GRANT ALL ON public.bank_accounts TO service_role;

CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, email text, phone text, document text, address text, city text,
  type text NOT NULL DEFAULT 'PJ', notes text,
  business_unit_id uuid REFERENCES public.business_units(id),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT,INSERT,UPDATE,DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;

CREATE TABLE IF NOT EXISTS public.import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_kind text NOT NULL, file_name text NOT NULL,
  row_count int DEFAULT 0, success_count int DEFAULT 0, error_count int DEFAULT 0,
  status public.import_status NOT NULL DEFAULT 'processando',
  imported_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  error_log jsonb);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.import_batches TO authenticated;
GRANT ALL ON public.import_batches TO service_role;

CREATE TABLE IF NOT EXISTS public.bank_statement_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id uuid REFERENCES public.bank_accounts(id),
  transaction_date date NOT NULL, description text, document_number text,
  amount numeric NOT NULL, direction text, raw_payload jsonb,
  import_batch_id uuid REFERENCES public.import_batches(id),
  suggested_match_id uuid,
  conciliation_status public.conciliation_status NOT NULL DEFAULT 'pendente',
  created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT,INSERT,UPDATE,DELETE ON public.bank_statement_entries TO authenticated;
GRANT ALL ON public.bank_statement_entries TO service_role;

CREATE TABLE IF NOT EXISTS public.financial_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date date NOT NULL, competence_month text, business_unit text,
  movement_account text, movement_description text, counterparty_name text,
  amount_in numeric DEFAULT 0, amount_out numeric DEFAULT 0, amount_signed numeric,
  entry_type public.entry_type,
  source_type public.source_type NOT NULL DEFAULT 'manual',
  source_file_name text, source_sheet_name text,
  bank_account_id uuid REFERENCES public.bank_accounts(id),
  conciliation_group_id uuid,
  conciliation_status public.conciliation_status NOT NULL DEFAULT 'pendente',
  document_reference text,
  import_batch_id uuid REFERENCES public.import_batches(id),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  transfer_pair_id uuid,
  currency text NOT NULL DEFAULT 'BRL',
  exchange_rate numeric NOT NULL DEFAULT 1,
  original_amount numeric, total_brl numeric, fx_status text, fx_variation numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT,INSERT,UPDATE,DELETE ON public.financial_entries TO authenticated;
GRANT ALL ON public.financial_entries TO service_role;

CREATE TABLE IF NOT EXISTS public.conciliation_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_statement_entry_id uuid NOT NULL REFERENCES public.bank_statement_entries(id),
  financial_entry_id uuid NOT NULL REFERENCES public.financial_entries(id),
  match_type public.match_type NOT NULL DEFAULT 'automatico',
  match_score numeric,
  status public.match_status NOT NULL DEFAULT 'sugerido',
  confirmed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT,INSERT,UPDATE,DELETE ON public.conciliation_matches TO authenticated;
GRANT ALL ON public.conciliation_matches TO service_role;

CREATE TABLE IF NOT EXISTS public.devis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number text, devis_number text UNIQUE,
  client_id uuid REFERENCES public.clients(id),
  title text NOT NULL, description text,
  total_amount numeric NOT NULL DEFAULT 0,
  down_payment_amount numeric NOT NULL DEFAULT 0,
  status public.devis_status NOT NULL DEFAULT 'rascunho',
  business_unit text, service_type text, responsible_sector text,
  scope_description text, proposal_structure text, notes text,
  meeting_date date, meeting_summary text, meeting_report text,
  commercial_responsible uuid,
  validation_client_confirmed  boolean NOT NULL DEFAULT false,
  validation_service_confirmed boolean NOT NULL DEFAULT false,
  validation_sector_defined    boolean NOT NULL DEFAULT false,
  validation_amount_confirmed  boolean NOT NULL DEFAULT false,
  validation_deadline_defined  boolean NOT NULL DEFAULT false,
  validated_at timestamptz, validated_by uuid,
  deadline_date date, approved_at timestamptz,
  initial_charge_generated boolean DEFAULT false,
  final_charge_generated   boolean DEFAULT false,
  accept_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  accepted_at timestamptz, accepted_ip text,
  rejected_at timestamptz, rejected_ip text,
  sent_at timestamptz,
  source_language text NOT NULL DEFAULT 'pt',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.devis
  ADD CONSTRAINT devis_commercial_responsible_fkey
  FOREIGN KEY (commercial_responsible) REFERENCES auth.users(id) ON DELETE SET NULL NOT VALID;
ALTER TABLE public.devis
  ADD CONSTRAINT devis_validated_by_fkey
  FOREIGN KEY (validated_by) REFERENCES auth.users(id) ON DELETE SET NULL NOT VALID;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.devis TO authenticated;
GRANT ALL ON public.devis TO service_role;

CREATE TABLE IF NOT EXISTS public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  devis_id uuid REFERENCES public.devis(id),
  client_id uuid REFERENCES public.clients(id),
  business_unit text, responsible_sector text,
  title text NOT NULL, description text,
  status public.service_status NOT NULL DEFAULT 'pendente',
  start_date date, expected_end_date date, actual_end_date date,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  final_charge_generated boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT,INSERT,UPDATE,DELETE ON public.services TO authenticated;
GRANT ALL ON public.services TO service_role;

CREATE TABLE IF NOT EXISTS public.system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT,INSERT,UPDATE,DELETE ON public.system_settings TO authenticated;
GRANT ALL ON public.system_settings TO service_role;

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text, email text, avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT,INSERT,UPDATE,DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role));
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL, entity_type text, entity_id uuid, details jsonb,
  created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT,INSERT,UPDATE,DELETE ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

CREATE TABLE IF NOT EXISTS public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, key_hash text NOT NULL UNIQUE, key_prefix text NOT NULL,
  scopes text[] NOT NULL DEFAULT ARRAY['comercial','financeiro','operacao']::text[],
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz, usage_count bigint NOT NULL DEFAULT 0,
  revoked_at timestamptz);
ALTER TABLE public.api_keys
  ADD CONSTRAINT api_keys_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL NOT VALID;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.api_keys TO authenticated;
GRANT ALL ON public.api_keys TO service_role;

CREATE TABLE IF NOT EXISTS public.email_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id text, template_name text NOT NULL,
  recipient_email text NOT NULL, status text NOT NULL,
  error_message text, metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.email_send_log TO service_role;

CREATE TABLE IF NOT EXISTS public.email_send_state (
  id int PRIMARY KEY DEFAULT 1,
  retry_after_until timestamptz,
  batch_size int NOT NULL DEFAULT 10,
  send_delay_ms int NOT NULL DEFAULT 200,
  auth_email_ttl_minutes int NOT NULL DEFAULT 15,
  transactional_email_ttl_minutes int NOT NULL DEFAULT 60,
  updated_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.email_send_state TO service_role;

CREATE TABLE IF NOT EXISTS public.email_unsubscribe_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE, token text NOT NULL UNIQUE,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.email_unsubscribe_tokens TO service_role;

CREATE TABLE IF NOT EXISTS public.suppressed_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL, reason text NOT NULL, metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.suppressed_emails TO service_role;

-- ---------- Índices ----------
CREATE INDEX IF NOT EXISTS idx_api_keys_hash         ON public.api_keys (key_hash) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_created    ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity     ON public.audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user       ON public.audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_bank_statement_date   ON public.bank_statement_entries (transaction_date);
CREATE INDEX IF NOT EXISTS idx_bank_statement_status ON public.bank_statement_entries (conciliation_status);
CREATE INDEX IF NOT EXISTS idx_bse_import_batch      ON public.bank_statement_entries (import_batch_id);
CREATE INDEX IF NOT EXISTS idx_clients_active        ON public.clients (active);
CREATE INDEX IF NOT EXISTS idx_clients_business_unit ON public.clients (business_unit_id);
CREATE INDEX IF NOT EXISTS idx_clients_name_lower    ON public.clients (lower(name));
CREATE INDEX IF NOT EXISTS idx_cm_bse                ON public.conciliation_matches (bank_statement_entry_id);
CREATE INDEX IF NOT EXISTS idx_cm_fe                 ON public.conciliation_matches (financial_entry_id);
CREATE INDEX IF NOT EXISTS idx_cm_status             ON public.conciliation_matches (status);
CREATE INDEX IF NOT EXISTS idx_devis_accept_token    ON public.devis (accept_token);
CREATE INDEX IF NOT EXISTS idx_devis_business_unit   ON public.devis (business_unit);
CREATE INDEX IF NOT EXISTS idx_devis_client_id       ON public.devis (client_id);
CREATE INDEX IF NOT EXISTS idx_devis_commercial_responsible ON public.devis (commercial_responsible);
CREATE INDEX IF NOT EXISTS idx_devis_created_at      ON public.devis (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_devis_status          ON public.devis (status);
CREATE INDEX IF NOT EXISTS idx_email_send_log_created   ON public.email_send_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_send_log_message   ON public.email_send_log (message_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_send_log_message_sent_unique
  ON public.email_send_log (message_id) WHERE status = 'sent';
CREATE INDEX IF NOT EXISTS idx_email_send_log_recipient ON public.email_send_log (recipient_email);
CREATE INDEX IF NOT EXISTS idx_unsubscribe_tokens_token ON public.email_unsubscribe_tokens (token);
CREATE INDEX IF NOT EXISTS idx_fe_document_reference    ON public.financial_entries (document_reference);

-- ---------- Funções ----------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION app_private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name',''), NEW.email);
  RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.next_devis_number(_prefix text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE ym text; next_seq int; pfx text;
BEGIN
  pfx := upper(coalesce(_prefix,'DE'));
  IF pfx NOT IN ('DE','AM','CO') THEN pfx := 'DE'; END IF;
  ym := to_char(now(),'YYYYMM');
  SELECT COALESCE(MAX(CAST(SUBSTRING(devis_number FROM (length(pfx)+7)) AS INT)),0)+1
    INTO next_seq FROM public.devis WHERE devis_number LIKE pfx||ym||'%';
  RETURN pfx||ym||lpad(next_seq::text,3,'0');
END; $$;

CREATE OR REPLACE FUNCTION public.generate_devis_number()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE prefix text; st text; next_seq int; ym text;
BEGIN
  IF NEW.devis_number IS NOT NULL AND NEW.devis_number<>'' THEN RETURN NEW; END IF;
  st := lower(coalesce(NEW.service_type,''));
  IF st ~ '(ambient|environment|ambiental)' THEN prefix:='AM';
  ELSIF st ~ '(cont[áa]bil|cont[aá]bei|accounting|fiscal|tribut)' THEN prefix:='CO';
  ELSE prefix:='DE'; END IF;
  ym := to_char(coalesce(NEW.created_at,now()),'YYYYMM');
  SELECT COALESCE(MAX(CAST(SUBSTRING(devis_number FROM (length(prefix)+7)) AS INT)),0)+1
    INTO next_seq FROM public.devis WHERE devis_number LIKE prefix||ym||'%';
  NEW.devis_number := prefix||ym||lpad(next_seq::text,3,'0');
  RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.calc_devis_down_payment()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.down_payment_amount IS NULL OR NEW.down_payment_amount=0 THEN
      NEW.down_payment_amount := COALESCE(NEW.total_amount,0)*0.5;
    END IF;
  ELSIF TG_OP='UPDATE' THEN
    IF NEW.total_amount IS DISTINCT FROM OLD.total_amount
       AND NEW.down_payment_amount IS NOT DISTINCT FROM OLD.down_payment_amount THEN
      NEW.down_payment_amount := COALESCE(NEW.total_amount,0)*0.5;
    END IF;
  END IF;
  RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.fx_recompute_total_brl()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.original_amount IS NULL THEN
    NEW.original_amount := COALESCE(NULLIF(NEW.amount_in,0), NEW.amount_out, 0);
  END IF;
  IF COALESCE(NEW.fx_status,'') <> 'com_variacao_cambial' THEN
    NEW.total_brl := COALESCE(NEW.original_amount,0)*COALESCE(NEW.exchange_rate,1);
  END IF;
  RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.devis_status_progression()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE c int; pre text[] := ARRAY['rascunho','reuniao_realizada','proposta_em_geracao','aguardando_validacao','pronta_para_envio'];
BEGIN
  IF NEW.status IS NOT NULL AND NOT (NEW.status::text = ANY(pre)) THEN RETURN NEW; END IF;
  c := (CASE WHEN NEW.validation_client_confirmed THEN 1 ELSE 0 END)
     + (CASE WHEN NEW.validation_service_confirmed THEN 1 ELSE 0 END)
     + (CASE WHEN NEW.validation_sector_defined THEN 1 ELSE 0 END)
     + (CASE WHEN NEW.validation_amount_confirmed THEN 1 ELSE 0 END)
     + (CASE WHEN NEW.validation_deadline_defined THEN 1 ELSE 0 END);
  IF c=5 OR NEW.validated_at IS NOT NULL THEN NEW.status:='pronta_para_envio';
  ELSIF c>=1 THEN NEW.status:='aguardando_validacao';
  ELSIF coalesce(NEW.proposal_structure,'')<>'' OR coalesce(NEW.scope_description,'')<>'' THEN
    NEW.status:='proposta_em_geracao';
  ELSE NEW.status:='reuniao_realizada'; END IF;
  RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.devis_accepted_create_service()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.accepted_at IS NOT NULL AND (TG_OP='INSERT' OR OLD.accepted_at IS NULL) THEN
    IF NOT EXISTS (SELECT 1 FROM public.services WHERE devis_id=NEW.id) THEN
      INSERT INTO public.services (devis_id,client_id,business_unit,responsible_sector,
        title,description,status,expected_end_date)
      VALUES (NEW.id,NEW.client_id,NEW.business_unit,NEW.responsible_sector,
        coalesce(NEW.title,'Serviço — '||coalesce(NEW.devis_number,'')),
        NEW.scope_description,'a_iniciar'::public.service_status,NEW.deadline_date);
    END IF;
  END IF;
  RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.create_devis_initial_charge(_devis_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE d RECORD; client_name text; charge_amount numeric;
BEGIN
  SELECT * INTO d FROM public.devis WHERE id=_devis_id;
  IF NOT FOUND OR d.accepted_at IS NULL THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.financial_entries WHERE document_reference=d.id::text) THEN
    UPDATE public.devis SET initial_charge_generated=true
      WHERE id=d.id AND COALESCE(initial_charge_generated,false)=false;
    RETURN; END IF;
  charge_amount := COALESCE(NULLIF(d.down_payment_amount,0), COALESCE(d.total_amount,0)*0.5);
  IF charge_amount<=0 THEN RETURN; END IF;
  SELECT name INTO client_name FROM public.clients WHERE id=d.client_id;
  INSERT INTO public.financial_entries(entry_date,competence_month,business_unit,
    movement_description,counterparty_name,amount_in,amount_out,entry_type,source_type,
    conciliation_status,document_reference,user_id)
  VALUES (CURRENT_DATE,to_char(CURRENT_DATE,'YYYY-MM'),d.business_unit,
    'Cobrança inicial 50% — Devis #'||left(d.id::text,8)||' — '||COALESCE(d.title,''),
    client_name,charge_amount,0,'receita'::public.entry_type,'manual'::public.source_type,
    'pendente'::public.conciliation_status,d.id::text,d.created_by);
  UPDATE public.devis SET initial_charge_generated=true WHERE id=d.id;
END; $$;

CREATE OR REPLACE FUNCTION public.trg_devis_accepted_charge()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.accepted_at IS NOT NULL AND (TG_OP='INSERT' OR OLD.accepted_at IS NULL) THEN
    PERFORM public.create_devis_initial_charge(NEW.id);
  END IF;
  RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.auto_advance_sent_devis()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  UPDATE public.devis SET status='aguardando_aceite'
   WHERE status='enviada_ao_cliente' AND sent_at IS NOT NULL
     AND sent_at < now() - interval '30 seconds'
     AND accepted_at IS NULL AND rejected_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.validate_api_key(_key_hash text)
RETURNS TABLE(id uuid, name text, scopes text[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _row public.api_keys;
BEGIN
  SELECT * INTO _row FROM public.api_keys WHERE key_hash=_key_hash AND revoked_at IS NULL LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE public.api_keys SET last_used_at=now(), usage_count=usage_count+1 WHERE public.api_keys.id=_row.id;
  RETURN QUERY SELECT _row.id, _row.name, _row.scopes;
END; $$;

CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name text, payload jsonb)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN RETURN pgmq.send(queue_name,payload);
EXCEPTION WHEN undefined_table THEN PERFORM pgmq.create(queue_name); RETURN pgmq.send(queue_name,payload);
END; $$;

CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name text, batch_size int, vt int)
RETURNS TABLE(msg_id bigint, read_ct int, message jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN RETURN QUERY SELECT r.msg_id,r.read_ct,r.message FROM pgmq.read(queue_name,vt,batch_size) r;
EXCEPTION WHEN undefined_table THEN PERFORM pgmq.create(queue_name); RETURN; END; $$;

CREATE OR REPLACE FUNCTION public.delete_email(queue_name text, message_id bigint)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN RETURN pgmq.delete(queue_name,message_id);
EXCEPTION WHEN undefined_table THEN RETURN FALSE; END; $$;

CREATE OR REPLACE FUNCTION public.move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE new_id BIGINT;
BEGIN
  SELECT pgmq.send(dlq_name,payload) INTO new_id;
  PERFORM pgmq.delete(source_queue,message_id);
  RETURN new_id;
EXCEPTION WHEN undefined_table THEN
  BEGIN PERFORM pgmq.create(dlq_name); EXCEPTION WHEN OTHERS THEN NULL; END;
  SELECT pgmq.send(dlq_name,payload) INTO new_id;
  BEGIN PERFORM pgmq.delete(source_queue,message_id); EXCEPTION WHEN undefined_table THEN NULL; END;
  RETURN new_id;
END; $$;

CREATE OR REPLACE FUNCTION public.bi_kpis_comercial(_from date DEFAULT NULL,_to date DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH base AS (SELECT status,total_amount,accepted_at,rejected_at FROM public.devis
    WHERE (_from IS NULL OR created_at>=_from) AND (_to IS NULL OR created_at<=(_to::timestamp+interval '1 day'))),
  agg AS (SELECT COUNT(*)::bigint AS total_devis,
    COUNT(*) FILTER (WHERE accepted_at IS NOT NULL)::bigint AS accepted,
    COUNT(*) FILTER (WHERE rejected_at IS NOT NULL)::bigint AS rejected,
    COALESCE(SUM(total_amount),0)::numeric AS total_amount,
    COALESCE(SUM(total_amount) FILTER (WHERE accepted_at IS NOT NULL),0)::numeric AS accepted_amount FROM base),
  by_status AS (SELECT jsonb_object_agg(status,c) AS by_status
    FROM (SELECT status,COUNT(*)::bigint c FROM base GROUP BY status) s)
  SELECT jsonb_build_object('total_devis',agg.total_devis,'accepted',agg.accepted,'rejected',agg.rejected,
    'conversion_rate', CASE WHEN agg.total_devis>0 THEN agg.accepted::numeric/agg.total_devis ELSE 0 END,
    'total_amount',agg.total_amount,'accepted_amount',agg.accepted_amount,
    'avg_ticket', CASE WHEN agg.total_devis>0 THEN agg.total_amount/agg.total_devis ELSE 0 END,
    'by_status', COALESCE(by_status.by_status,'{}'::jsonb)) FROM agg,by_status;
$$;

CREATE OR REPLACE FUNCTION public.bi_kpis_financeiro(_from date DEFAULT NULL,_to date DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH base AS (SELECT entry_date,amount_in,amount_out FROM public.financial_entries
    WHERE (_from IS NULL OR entry_date>=_from) AND (_to IS NULL OR entry_date<=_to)),
  totals AS (SELECT COALESCE(SUM(amount_in),0)::numeric total_in,
    COALESCE(SUM(amount_out),0)::numeric total_out, COUNT(*)::bigint entries_count FROM base),
  by_month AS (SELECT jsonb_object_agg(month,payload) by_month FROM (
    SELECT to_char(entry_date,'YYYY-MM') month,
      jsonb_build_object('in',COALESCE(SUM(amount_in),0),'out',COALESCE(SUM(amount_out),0),
        'net',COALESCE(SUM(amount_in),0)-COALESCE(SUM(amount_out),0)) payload
    FROM base WHERE entry_date IS NOT NULL GROUP BY 1) m)
  SELECT jsonb_build_object('total_in',totals.total_in,'total_out',totals.total_out,
    'net',totals.total_in-totals.total_out,'entries_count',totals.entries_count,
    'by_month',COALESCE(by_month.by_month,'{}'::jsonb)) FROM totals,by_month;
$$;

CREATE OR REPLACE FUNCTION public.bi_kpis_operacao(_from date DEFAULT NULL,_to date DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH base AS (SELECT status,expected_end_date,actual_end_date FROM public.services
    WHERE (_from IS NULL OR created_at>=_from) AND (_to IS NULL OR created_at<=(_to::timestamp+interval '1 day'))),
  agg AS (SELECT COUNT(*)::bigint total_services,
    COUNT(*) FILTER (WHERE actual_end_date IS NOT NULL)::bigint completed,
    COUNT(*) FILTER (WHERE expected_end_date IS NOT NULL AND actual_end_date IS NULL
                      AND expected_end_date<CURRENT_DATE)::bigint delayed FROM base),
  by_status AS (SELECT jsonb_object_agg(status,c) by_status
    FROM (SELECT status,COUNT(*)::bigint c FROM base GROUP BY status) s)
  SELECT jsonb_build_object('total_services',agg.total_services,'completed',agg.completed,
    'delayed',agg.delayed,'in_progress',agg.total_services-agg.completed,
    'by_status',COALESCE(by_status.by_status,'{}'::jsonb)) FROM agg,by_status;
$$;

CREATE OR REPLACE FUNCTION public.financeiro_summary(_competence text DEFAULT NULL,
  _business text DEFAULT NULL,_search text DEFAULT NULL,_bank uuid DEFAULT NULL,
  _type text DEFAULT NULL,_status text DEFAULT NULL,_origin text DEFAULT NULL,_realized text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH base AS (SELECT * FROM public.financial_entries fe
    WHERE (_competence IS NULL OR fe.competence_month=_competence)
      AND (_business IS NULL OR fe.business_unit=_business)
      AND (_bank IS NULL OR fe.bank_account_id=_bank)
      AND (_type IS NULL OR fe.entry_type::text=_type)
      AND (_status IS NULL OR fe.conciliation_status::text=_status)
      AND (_search IS NULL OR fe.movement_description ILIKE '%'||_search||'%' OR fe.counterparty_name ILIKE '%'||_search||'%')
      AND (_origin IS NULL
        OR (_origin='transferência' AND fe.entry_type::text='transferencia')
        OR (_origin='ofx' AND fe.source_type::text IN ('ofx','extrato'))
        OR (_origin='comercial' AND fe.document_reference IS NOT NULL AND fe.entry_type::text<>'transferencia')
        OR (_origin='manual' AND fe.source_type::text='manual' AND fe.document_reference IS NULL))
      AND (_realized IS NULL
        OR (_realized='previsto' AND fe.conciliation_status::text='pendente')
        OR (_realized='realizado' AND fe.conciliation_status::text<>'pendente'))),
  realized AS (SELECT COALESCE(SUM(amount_in),0)::numeric total_in,
    COALESCE(SUM(amount_out),0)::numeric total_out FROM base
    WHERE conciliation_status::text<>'pendente' AND COALESCE(entry_type::text,'')<>'transferencia'),
  transfers AS (SELECT COALESCE(SUM(COALESCE(amount_in,0)+COALESCE(amount_out,0)),0)::numeric transfers
    FROM base WHERE entry_type::text='transferencia'),
  previsto AS (SELECT COALESCE(SUM(amount_in),0)::numeric previsto_in FROM base
    WHERE conciliation_status::text='pendente' AND COALESCE(entry_type::text,'')<>'transferencia')
  SELECT jsonb_build_object('saldoInicial',0,'totalIn',realized.total_in,'totalOut',realized.total_out,
    'transfers',transfers.transfers,'saldoFinal',realized.total_in-realized.total_out,
    'disponivel',realized.total_in-realized.total_out,'previstoIn',previsto.previsto_in,
    'entries_count',(SELECT COUNT(*) FROM base)) FROM realized,transfers,previsto;
$$;

CREATE OR REPLACE FUNCTION public.financeiro_analitico(_competence text DEFAULT NULL,
  _business text DEFAULT NULL,_search text DEFAULT NULL,_bank uuid DEFAULT NULL,
  _type text DEFAULT NULL,_status text DEFAULT NULL,_origin text DEFAULT NULL,_realized text DEFAULT NULL)
RETURNS TABLE(competence text, total_in numeric, total_out numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH base AS (SELECT * FROM public.financial_entries fe
    WHERE (_competence IS NULL OR fe.competence_month=_competence)
      AND (_business IS NULL OR fe.business_unit=_business)
      AND (_bank IS NULL OR fe.bank_account_id=_bank)
      AND (_type IS NULL OR fe.entry_type::text=_type)
      AND (_status IS NULL OR fe.conciliation_status::text=_status)
      AND (_search IS NULL OR fe.movement_description ILIKE '%'||_search||'%' OR fe.counterparty_name ILIKE '%'||_search||'%')
      AND (_origin IS NULL
        OR (_origin='transferência' AND fe.entry_type::text='transferencia')
        OR (_origin='ofx' AND fe.source_type::text IN ('ofx','extrato'))
        OR (_origin='comercial' AND fe.document_reference IS NOT NULL AND fe.entry_type::text<>'transferencia')
        OR (_origin='manual' AND fe.source_type::text='manual' AND fe.document_reference IS NULL))
      AND (_realized IS NULL
        OR (_realized='previsto' AND fe.conciliation_status::text='pendente')
        OR (_realized='realizado' AND fe.conciliation_status::text<>'pendente')))
  SELECT COALESCE(competence_month,'—') competence,
    COALESCE(SUM(amount_in),0)::numeric total_in,
    COALESCE(SUM(amount_out),0)::numeric total_out
  FROM base WHERE COALESCE(entry_type::text,'')<>'transferencia'
  GROUP BY 1 ORDER BY 1 DESC;
$$;

-- ---------- Triggers ----------
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
CREATE TRIGGER update_bank_accounts_updated_at  BEFORE UPDATE ON public.bank_accounts  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_business_units_updated_at BEFORE UPDATE ON public.business_units FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_clients_updated_at        BEFORE UPDATE ON public.clients        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_devis_updated_at          BEFORE UPDATE ON public.devis          FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_financial_entries_updated_at BEFORE UPDATE ON public.financial_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at       BEFORE UPDATE ON public.profiles       FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_services_updated_at       BEFORE UPDATE ON public.services       FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON public.system_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_generate_devis_number    BEFORE INSERT ON public.devis FOR EACH ROW EXECUTE FUNCTION public.generate_devis_number();
CREATE TRIGGER trg_calc_devis_down_payment  BEFORE INSERT OR UPDATE ON public.devis FOR EACH ROW EXECUTE FUNCTION public.calc_devis_down_payment();
CREATE TRIGGER trg_devis_status_progression BEFORE INSERT OR UPDATE ON public.devis FOR EACH ROW EXECUTE FUNCTION public.devis_status_progression();
CREATE TRIGGER trg_devis_accepted_create_service AFTER INSERT OR UPDATE OF accepted_at ON public.devis FOR EACH ROW EXECUTE FUNCTION public.devis_accepted_create_service();
CREATE TRIGGER trg_devis_accepted_create_charge  AFTER INSERT OR UPDATE OF accepted_at ON public.devis FOR EACH ROW EXECUTE FUNCTION public.trg_devis_accepted_charge();
CREATE TRIGGER trg_financial_entries_fx BEFORE INSERT OR UPDATE ON public.financial_entries FOR EACH ROW EXECUTE FUNCTION public.fx_recompute_total_brl();

-- ---------- RLS ----------
ALTER TABLE public.api_keys                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_statement_entries  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_units          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conciliation_matches    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devis                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_send_log          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_send_state        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_unsubscribe_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_entries       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_batches          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppressed_emails       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles              ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage api_keys" ON public.api_keys FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins can view audit_logs" ON public.audit_logs FOR SELECT USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Authenticated users can insert audit_logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (auth.uid()=user_id);
CREATE POLICY "Admins and financeiro can manage bank_accounts" ON public.bank_accounts FOR ALL
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro'));
CREATE POLICY "Admins and financeiro can manage bank_statement_entries" ON public.bank_statement_entries FOR ALL
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro'));
CREATE POLICY "Authenticated users can view business_units" ON public.business_units FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage business_units" ON public.business_units FOR ALL USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins and comercial can manage clients" ON public.clients FOR ALL
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'comercial'));
CREATE POLICY "Admins and comercial can view clients" ON public.clients FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'comercial') OR public.has_role(auth.uid(),'financeiro'));
CREATE POLICY "Admins and financeiro can manage conciliation_matches" ON public.conciliation_matches FOR ALL
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro'));
CREATE POLICY "Admins and comercial can manage devis" ON public.devis FOR ALL
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'comercial'));
CREATE POLICY "Service role can read send log"   ON public.email_send_log FOR SELECT USING (auth.role()='service_role');
CREATE POLICY "Service role can insert send log" ON public.email_send_log FOR INSERT WITH CHECK (auth.role()='service_role');
CREATE POLICY "Service role can update send log" ON public.email_send_log FOR UPDATE USING (auth.role()='service_role') WITH CHECK (auth.role()='service_role');
CREATE POLICY "Service role can manage send state" ON public.email_send_state FOR ALL USING (auth.role()='service_role') WITH CHECK (auth.role()='service_role');
CREATE POLICY "Service role can read tokens"   ON public.email_unsubscribe_tokens FOR SELECT USING (auth.role()='service_role');
CREATE POLICY "Service role can insert tokens" ON public.email_unsubscribe_tokens FOR INSERT WITH CHECK (auth.role()='service_role');
CREATE POLICY "Service role can mark tokens as used" ON public.email_unsubscribe_tokens FOR UPDATE USING (auth.role()='service_role') WITH CHECK (auth.role()='service_role');
CREATE POLICY "Admins and financeiro can manage financial_entries" ON public.financial_entries FOR ALL
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro'));
CREATE POLICY "Admins and financeiro can manage import_batches" ON public.import_batches FOR ALL
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro'));
CREATE POLICY "Users can view own profile"   ON public.profiles FOR SELECT USING (auth.uid()=user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid()=user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid()=user_id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins can delete profiles"   ON public.profiles FOR DELETE USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins can insert profiles"   ON public.profiles FOR INSERT WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins can update profiles"   ON public.profiles FOR UPDATE USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins and operacao can manage services" ON public.services FOR ALL
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operacao'));
CREATE POLICY "Role-based view of services" ON public.services FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operacao')
      OR public.has_role(auth.uid(),'comercial') OR public.has_role(auth.uid(),'financeiro'));
CREATE POLICY "Service role can read suppressed emails"   ON public.suppressed_emails FOR SELECT USING (auth.role()='service_role');
CREATE POLICY "Service role can insert suppressed emails" ON public.suppressed_emails FOR INSERT WITH CHECK (auth.role()='service_role');
CREATE POLICY "Authenticated users can view system_settings" ON public.system_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert system_settings" ON public.system_settings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins can update system_settings" ON public.system_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid()=user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(),'admin')) WITH CHECK (app_private.has_role(auth.uid(),'admin'));
CREATE POLICY "Only admins can modify roles (restrictive)" ON public.user_roles AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(),'admin')) WITH CHECK (app_private.has_role(auth.uid(),'admin'));

-- =====================================================================
-- FIM. Cron jobs e Storage em arquivos separados.
-- =====================================================================
