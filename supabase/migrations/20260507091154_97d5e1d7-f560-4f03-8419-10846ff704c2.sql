
ALTER TABLE public.import_batches DROP CONSTRAINT import_batches_imported_by_fkey,
  ADD CONSTRAINT import_batches_imported_by_fkey FOREIGN KEY (imported_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.financial_entries DROP CONSTRAINT financial_entries_user_id_fkey,
  ADD CONSTRAINT financial_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.conciliation_matches DROP CONSTRAINT conciliation_matches_confirmed_by_fkey,
  ADD CONSTRAINT conciliation_matches_confirmed_by_fkey FOREIGN KEY (confirmed_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.devis DROP CONSTRAINT devis_created_by_fkey,
  ADD CONSTRAINT devis_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.services DROP CONSTRAINT services_assigned_to_fkey,
  ADD CONSTRAINT services_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.audit_logs DROP CONSTRAINT audit_logs_user_id_fkey,
  ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
