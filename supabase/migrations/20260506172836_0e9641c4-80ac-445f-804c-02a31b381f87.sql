-- devis_number generator
ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS devis_number TEXT;

CREATE OR REPLACE FUNCTION public.generate_devis_number()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  prefix TEXT;
  next_seq INT;
BEGIN
  IF NEW.devis_number IS NOT NULL AND NEW.devis_number <> '' THEN
    RETURN NEW;
  END IF;
  prefix := 'DE' || to_char(COALESCE(NEW.created_at, now()), 'YYYYMM');
  SELECT COALESCE(MAX(CAST(SUBSTRING(devis_number FROM 9) AS INT)), 0) + 1
    INTO next_seq
  FROM public.devis
  WHERE devis_number LIKE prefix || '%';
  NEW.devis_number := prefix || lpad(next_seq::text, 3, '0');
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_generate_devis_number ON public.devis;
CREATE TRIGGER trg_generate_devis_number BEFORE INSERT ON public.devis
FOR EACH ROW EXECUTE FUNCTION public.generate_devis_number();

ALTER TABLE public.devis DROP CONSTRAINT IF EXISTS devis_devis_number_key;
ALTER TABLE public.devis ADD CONSTRAINT devis_devis_number_key UNIQUE (devis_number);

-- Rejection columns
ALTER TABLE public.devis
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS rejected_ip TEXT NULL;

-- Realtime
ALTER TABLE public.devis REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'devis'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.devis';
  END IF;
END $$;

-- pg_cron auto-advance
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.auto_advance_sent_devis()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.devis
     SET status = 'aguardando_aceite'
   WHERE status = 'enviada_ao_cliente'
     AND sent_at IS NOT NULL
     AND sent_at < now() - interval '30 seconds'
     AND accepted_at IS NULL
     AND rejected_at IS NULL;
$$;

DO $$
DECLARE job_id BIGINT;
BEGIN
  SELECT jobid INTO job_id FROM cron.job WHERE jobname = 'devis-auto-advance-sent';
  IF job_id IS NOT NULL THEN PERFORM cron.unschedule(job_id); END IF;
END $$;

SELECT cron.schedule('devis-auto-advance-sent', '15 seconds',
  $$ SELECT public.auto_advance_sent_devis(); $$);

-- system_settings
CREATE TABLE public.system_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL UNIQUE,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view system_settings" ON public.system_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert system_settings" ON public.system_settings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update system_settings" ON public.system_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON public.system_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Hardening: revoke public execute on sensitive functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_advance_sent_devis() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;

-- Private schema for role checks (avoids exposing has_role to authenticated for RLS performance)
CREATE SCHEMA IF NOT EXISTS app_private;
CREATE OR REPLACE FUNCTION app_private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
GRANT USAGE ON SCHEMA app_private TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.has_role(uuid, public.app_role) TO authenticated;

-- Re-grant has_role to authenticated (needed by other RLS policies that reference public.has_role)
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- Restrict user_roles management policy to app_private.has_role
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (app_private.has_role(auth.uid(), 'admin'::public.app_role));

-- API keys table for external BI access
CREATE TABLE public.api_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT ARRAY['comercial','financeiro','operacao'],
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  usage_count BIGINT NOT NULL DEFAULT 0,
  revoked_at TIMESTAMPTZ
);
CREATE INDEX idx_api_keys_hash ON public.api_keys(key_hash) WHERE revoked_at IS NULL;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage api_keys" ON public.api_keys FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.validate_api_key(_key_hash TEXT)
RETURNS TABLE(id UUID, name TEXT, scopes TEXT[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _row public.api_keys;
BEGIN
  SELECT * INTO _row FROM public.api_keys
  WHERE key_hash = _key_hash AND revoked_at IS NULL LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE public.api_keys
    SET last_used_at = now(), usage_count = usage_count + 1
    WHERE public.api_keys.id = _row.id;
  RETURN QUERY SELECT _row.id, _row.name, _row.scopes;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.validate_api_key(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_api_key(TEXT) TO service_role;