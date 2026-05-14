ALTER TABLE public.financial_entries ADD COLUMN IF NOT EXISTS transfer_pair_id uuid;
CREATE INDEX IF NOT EXISTS idx_financial_entries_transfer_pair ON public.financial_entries(transfer_pair_id);
CREATE INDEX IF NOT EXISTS idx_financial_entries_bank_account ON public.financial_entries(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_financial_entries_competence ON public.financial_entries(competence_month);