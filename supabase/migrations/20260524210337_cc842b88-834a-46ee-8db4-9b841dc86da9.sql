
DROP POLICY IF EXISTS "Authenticated users can view bank_accounts" ON public.bank_accounts;
DROP POLICY IF EXISTS "Authenticated users can view bank_statement_entries" ON public.bank_statement_entries;
DROP POLICY IF EXISTS "Authenticated users can view clients" ON public.clients;
DROP POLICY IF EXISTS "Authenticated users can view conciliation_matches" ON public.conciliation_matches;
DROP POLICY IF EXISTS "Authenticated users can view devis" ON public.devis;
DROP POLICY IF EXISTS "Authenticated users can view financial_entries" ON public.financial_entries;
DROP POLICY IF EXISTS "Authenticated users can view import_batches" ON public.import_batches;

CREATE POLICY "Admins and comercial can view clients"
  ON public.clients FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'comercial'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));

CREATE POLICY "Only admins can modify roles (restrictive)"
  ON public.user_roles AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (app_private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated can read devis pdfs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload devis pdfs" ON storage.objects;

CREATE POLICY "Admin/comercial can read devis pdfs"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'devis-pdfs' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'comercial'::app_role)));

CREATE POLICY "Admin/comercial can upload devis pdfs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'devis-pdfs' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'comercial'::app_role)));

CREATE POLICY "Admin/comercial can update devis pdfs"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'devis-pdfs' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'comercial'::app_role)));

CREATE POLICY "Admin/comercial can delete devis pdfs"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'devis-pdfs' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'comercial'::app_role)));

ALTER PUBLICATION supabase_realtime DROP TABLE public.devis;

ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;
