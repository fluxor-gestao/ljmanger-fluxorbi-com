
-- ---------- Foreign Keys faltantes ----------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='devis_commercial_responsible_fkey') THEN
    ALTER TABLE public.devis ADD CONSTRAINT devis_commercial_responsible_fkey
      FOREIGN KEY (commercial_responsible) REFERENCES auth.users(id) ON DELETE SET NULL NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='devis_validated_by_fkey') THEN
    ALTER TABLE public.devis ADD CONSTRAINT devis_validated_by_fkey
      FOREIGN KEY (validated_by) REFERENCES auth.users(id) ON DELETE SET NULL NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='api_keys_created_by_fkey') THEN
    ALTER TABLE public.api_keys ADD CONSTRAINT api_keys_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

-- ---------- Índices ----------
CREATE INDEX IF NOT EXISTS idx_devis_client_id ON public.devis(client_id);
CREATE INDEX IF NOT EXISTS idx_devis_status ON public.devis(status);
CREATE INDEX IF NOT EXISTS idx_devis_created_at ON public.devis(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_devis_business_unit ON public.devis(business_unit);
CREATE INDEX IF NOT EXISTS idx_devis_accept_token ON public.devis(accept_token);
CREATE INDEX IF NOT EXISTS idx_devis_commercial_responsible ON public.devis(commercial_responsible);

CREATE INDEX IF NOT EXISTS idx_services_devis_id ON public.services(devis_id);
CREATE INDEX IF NOT EXISTS idx_services_client_id ON public.services(client_id);
CREATE INDEX IF NOT EXISTS idx_services_status ON public.services(status);
CREATE INDEX IF NOT EXISTS idx_services_expected_end ON public.services(expected_end_date);
CREATE INDEX IF NOT EXISTS idx_services_assigned_to ON public.services(assigned_to);

CREATE INDEX IF NOT EXISTS idx_clients_business_unit ON public.clients(business_unit_id);
CREATE INDEX IF NOT EXISTS idx_clients_name_lower ON public.clients(lower(name));
CREATE INDEX IF NOT EXISTS idx_clients_active ON public.clients(active);

CREATE INDEX IF NOT EXISTS idx_cm_bse ON public.conciliation_matches(bank_statement_entry_id);
CREATE INDEX IF NOT EXISTS idx_cm_fe ON public.conciliation_matches(financial_entry_id);
CREATE INDEX IF NOT EXISTS idx_cm_status ON public.conciliation_matches(status);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);

CREATE INDEX IF NOT EXISTS idx_bse_import_batch ON public.bank_statement_entries(import_batch_id);

CREATE INDEX IF NOT EXISTS idx_fe_document_reference ON public.financial_entries(document_reference);

-- ---------- RLS de services: restringir SELECT ----------
DROP POLICY IF EXISTS "Authenticated users can view services" ON public.services;

CREATE POLICY "Role-based view of services"
  ON public.services FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'operacao'::app_role)
    OR public.has_role(auth.uid(), 'comercial'::app_role)
    OR public.has_role(auth.uid(), 'financeiro'::app_role)
  );
