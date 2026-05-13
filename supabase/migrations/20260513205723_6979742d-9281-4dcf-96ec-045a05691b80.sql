
-- Função: cria lançamento de cobrança inicial 50% para um devis
CREATE OR REPLACE FUNCTION public.create_devis_initial_charge(_devis_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d RECORD;
  client_name TEXT;
  charge_amount NUMERIC;
BEGIN
  SELECT * INTO d FROM public.devis WHERE id = _devis_id;
  IF NOT FOUND OR d.accepted_at IS NULL THEN RETURN; END IF;

  -- Idempotência: já existe lançamento?
  IF EXISTS (
    SELECT 1 FROM public.financial_entries
    WHERE document_reference = d.id::text
  ) THEN
    -- Garante a flag mesmo que o lançamento já exista
    UPDATE public.devis SET initial_charge_generated = true
    WHERE id = d.id AND COALESCE(initial_charge_generated, false) = false;
    RETURN;
  END IF;

  charge_amount := COALESCE(NULLIF(d.down_payment_amount, 0), COALESCE(d.total_amount, 0) * 0.5);
  IF charge_amount <= 0 THEN RETURN; END IF;

  SELECT name INTO client_name FROM public.clients WHERE id = d.client_id;

  INSERT INTO public.financial_entries (
    entry_date,
    competence_month,
    business_unit,
    movement_description,
    counterparty_name,
    amount_in,
    amount_out,
    entry_type,
    source_type,
    conciliation_status,
    document_reference,
    user_id
  ) VALUES (
    CURRENT_DATE,
    to_char(CURRENT_DATE, 'YYYY-MM'),
    d.business_unit,
    'Cobrança inicial 50% — Devis #' || left(d.id::text, 8) || ' — ' || COALESCE(d.title, ''),
    client_name,
    charge_amount,
    0,
    'receita'::entry_type,
    'manual'::source_type,
    'pendente'::conciliation_status,
    d.id::text,
    d.created_by
  );

  UPDATE public.devis SET initial_charge_generated = true WHERE id = d.id;
END;
$$;

-- Trigger function: dispara quando accepted_at é setado
CREATE OR REPLACE FUNCTION public.trg_devis_accepted_charge()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.accepted_at IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.accepted_at IS NULL) THEN
    PERFORM public.create_devis_initial_charge(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_devis_accepted_create_charge ON public.devis;
CREATE TRIGGER trg_devis_accepted_create_charge
AFTER INSERT OR UPDATE OF accepted_at ON public.devis
FOR EACH ROW
EXECUTE FUNCTION public.trg_devis_accepted_charge();

-- Backfill: devis já aceitos sem lançamento correspondente
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT d.id
    FROM public.devis d
    WHERE d.accepted_at IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.financial_entries fe
        WHERE fe.document_reference = d.id::text
      )
  LOOP
    PERFORM public.create_devis_initial_charge(r.id);
  END LOOP;
END;
$$;
