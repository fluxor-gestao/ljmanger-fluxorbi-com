
-- 1) Apagar match errado e reverter financial entry do Bertrand
DELETE FROM public.conciliation_matches WHERE id = 'a486a6e8-0a6f-47bf-aa1a-e916f5879c42';
UPDATE public.financial_entries SET conciliation_status = 'pendente' WHERE id = 'ba556e48-df25-4d2c-947a-8470895c3f5a';

-- 2) Criar match correto Talyson <-> bank entry
INSERT INTO public.conciliation_matches (
  bank_statement_entry_id, financial_entry_id, match_score, match_type, status, confirmed_at
) VALUES (
  '9cd61c76-5041-4a02-9d5f-8a37d98c2e2e',
  '0e75dabb-ff8b-41d0-bd99-3daa16587f66',
  100, 'manual', 'confirmado', now()
);
UPDATE public.financial_entries SET conciliation_status = 'conciliado' WHERE id = '0e75dabb-ff8b-41d0-bd99-3daa16587f66';
UPDATE public.bank_statement_entries SET conciliation_status = 'conciliado' WHERE id = '9cd61c76-5041-4a02-9d5f-8a37d98c2e2e';

-- 3) Preencher direction NULL e normalizar amount para valor absoluto
UPDATE public.bank_statement_entries
   SET direction = CASE WHEN amount < 0 THEN 'saida' ELSE 'entrada' END
 WHERE direction IS NULL;

UPDATE public.bank_statement_entries
   SET amount = ABS(amount)
 WHERE amount < 0;
