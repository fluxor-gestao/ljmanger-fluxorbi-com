UPDATE public.devis
   SET status = 'pronta_para_envio',
       sent_at = NULL,
       accepted_at = NULL,
       rejected_at = NULL
 WHERE id = '94a0e765-3daf-4c29-b2fc-20cb9fa1e64c';