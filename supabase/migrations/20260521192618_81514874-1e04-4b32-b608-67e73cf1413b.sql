
-- Multi-currency support for financial_entries
ALTER TABLE public.financial_entries
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'BRL',
  ADD COLUMN IF NOT EXISTS exchange_rate numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS original_amount numeric,
  ADD COLUMN IF NOT EXISTS total_brl numeric,
  ADD COLUMN IF NOT EXISTS fx_variation numeric,
  ADD COLUMN IF NOT EXISTS fx_status text;

ALTER TABLE public.financial_entries
  DROP CONSTRAINT IF EXISTS financial_entries_currency_check;
ALTER TABLE public.financial_entries
  ADD CONSTRAINT financial_entries_currency_check
  CHECK (currency IN ('BRL','USD','EUR','GBP','CAD','CHF'));

ALTER TABLE public.financial_entries
  DROP CONSTRAINT IF EXISTS financial_entries_fx_status_check;
ALTER TABLE public.financial_entries
  ADD CONSTRAINT financial_entries_fx_status_check
  CHECK (fx_status IS NULL OR fx_status IN ('sem_variacao','com_variacao_cambial'));

-- Backfill
UPDATE public.financial_entries
  SET original_amount = COALESCE(original_amount, COALESCE(NULLIF(amount_in,0), amount_out, 0)),
      total_brl = COALESCE(total_brl, COALESCE(NULLIF(amount_in,0), amount_out, 0))
  WHERE original_amount IS NULL OR total_brl IS NULL;

-- Trigger to recompute total_brl
CREATE OR REPLACE FUNCTION public.fx_recompute_total_brl()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.original_amount IS NULL THEN
    NEW.original_amount := COALESCE(NULLIF(NEW.amount_in,0), NEW.amount_out, 0);
  END IF;
  IF COALESCE(NEW.fx_status,'') <> 'com_variacao_cambial' THEN
    NEW.total_brl := COALESCE(NEW.original_amount,0) * COALESCE(NEW.exchange_rate,1);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_financial_entries_fx ON public.financial_entries;
CREATE TRIGGER trg_financial_entries_fx
  BEFORE INSERT OR UPDATE ON public.financial_entries
  FOR EACH ROW EXECUTE FUNCTION public.fx_recompute_total_brl();
