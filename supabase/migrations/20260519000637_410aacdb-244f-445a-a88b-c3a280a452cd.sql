INSERT INTO public.services (devis_id, client_id, business_unit, responsible_sector,
                             title, description, status, expected_end_date)
SELECT d.id, d.client_id, d.business_unit, d.responsible_sector,
       coalesce(d.title, 'Serviço — ' || coalesce(d.devis_number,'')),
       d.scope_description, 'a_iniciar'::service_status, d.deadline_date
FROM public.devis d
WHERE d.accepted_at IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.services s WHERE s.devis_id = d.id);