
-- 1) Generalizar generate_devis_number para usar prefixo dinâmico (DE/AM/CO)
CREATE OR REPLACE FUNCTION public.generate_devis_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  prefix TEXT;
  st TEXT;
  next_seq INT;
  ym TEXT;
BEGIN
  IF NEW.devis_number IS NOT NULL AND NEW.devis_number <> '' THEN
    RETURN NEW;
  END IF;
  st := lower(coalesce(NEW.service_type, ''));
  IF st ~ '(ambient|environment|ambiental)' THEN
    prefix := 'AM';
  ELSIF st ~ '(cont[áa]bil|cont[aá]bei|accounting|fiscal|tribut)' THEN
    prefix := 'CO';
  ELSE
    prefix := 'DE';
  END IF;
  ym := to_char(coalesce(NEW.created_at, now()), 'YYYYMM');
  SELECT COALESCE(MAX(CAST(SUBSTRING(devis_number FROM (length(prefix)+7)) AS INT)), 0) + 1
    INTO next_seq
  FROM public.devis
  WHERE devis_number LIKE prefix || ym || '%';
  NEW.devis_number := prefix || ym || lpad(next_seq::text, 3, '0');
  RETURN NEW;
END;
$function$;

-- 2) RPC para o frontend pré-visualizar o próximo código
CREATE OR REPLACE FUNCTION public.next_devis_number(_prefix text)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  ym text;
  next_seq int;
  pfx text;
BEGIN
  pfx := upper(coalesce(_prefix, 'DE'));
  IF pfx NOT IN ('DE','AM','CO') THEN pfx := 'DE'; END IF;
  ym := to_char(now(), 'YYYYMM');
  SELECT COALESCE(MAX(CAST(SUBSTRING(devis_number FROM (length(pfx)+7)) AS INT)), 0) + 1
    INTO next_seq
  FROM public.devis
  WHERE devis_number LIKE pfx || ym || '%';
  RETURN pfx || ym || lpad(next_seq::text, 3, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_devis_number(text) TO authenticated;

-- 3) Trigger de progressão de status
CREATE OR REPLACE FUNCTION public.devis_status_progression()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  checks_count int;
  pre_send text[] := ARRAY['rascunho','reuniao_realizada','proposta_em_geracao','aguardando_validacao','pronta_para_envio'];
BEGIN
  -- Não mexer em estados pós-envio
  IF NEW.status IS NOT NULL AND NOT (NEW.status::text = ANY(pre_send)) THEN
    RETURN NEW;
  END IF;

  checks_count := (CASE WHEN NEW.validation_client_confirmed THEN 1 ELSE 0 END)
                + (CASE WHEN NEW.validation_service_confirmed THEN 1 ELSE 0 END)
                + (CASE WHEN NEW.validation_sector_defined THEN 1 ELSE 0 END)
                + (CASE WHEN NEW.validation_amount_confirmed THEN 1 ELSE 0 END)
                + (CASE WHEN NEW.validation_deadline_defined THEN 1 ELSE 0 END);

  IF checks_count = 5 OR NEW.validated_at IS NOT NULL THEN
    NEW.status := 'pronta_para_envio';
  ELSIF checks_count >= 1 THEN
    NEW.status := 'aguardando_validacao';
  ELSIF coalesce(NEW.proposal_structure,'') <> '' OR coalesce(NEW.scope_description,'') <> '' THEN
    NEW.status := 'proposta_em_geracao';
  ELSE
    NEW.status := 'reuniao_realizada';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_devis_status_progression ON public.devis;
CREATE TRIGGER trg_devis_status_progression
BEFORE INSERT OR UPDATE ON public.devis
FOR EACH ROW EXECUTE FUNCTION public.devis_status_progression();

-- 4) Trigger para criar service ao aceitar devis (religar Operação)
CREATE OR REPLACE FUNCTION public.devis_accepted_create_service()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.accepted_at IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.accepted_at IS NULL) THEN
    IF NOT EXISTS (SELECT 1 FROM public.services WHERE devis_id = NEW.id) THEN
      INSERT INTO public.services (
        devis_id, client_id, business_unit, responsible_sector,
        title, description, status, expected_end_date
      ) VALUES (
        NEW.id, NEW.client_id, NEW.business_unit, NEW.responsible_sector,
        coalesce(NEW.title, 'Serviço — ' || coalesce(NEW.devis_number,'')),
        NEW.scope_description, 'a_iniciar'::service_status, NEW.deadline_date
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_devis_accepted_create_service ON public.devis;
CREATE TRIGGER trg_devis_accepted_create_service
AFTER INSERT OR UPDATE OF accepted_at ON public.devis
FOR EACH ROW EXECUTE FUNCTION public.devis_accepted_create_service();

-- 5) Backfill: rascunhos legados viram reuniao_realizada (a trigger recalcula)
UPDATE public.devis SET status = 'reuniao_realizada' WHERE status = 'rascunho';
