-- =====================================================================
-- 0002_storage.sql  —  ARTEFATO (NÃO aplicar via Lovable)
-- Recria bucket devis-pdfs (privado) e policies em storage.objects.
-- A CÓPIA DOS ARQUIVOS continua PAUSADA até SERVICE_ROLE_KEY do antigo
-- ser confirmada — script migrate-storage.ts virá depois.
--
-- Aplicar:  psql "$NEW_SUPABASE_DB_URL" -f migrations-export/0002_storage.sql
-- =====================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('devis-pdfs', 'devis-pdfs', false, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Admin/comercial can read devis pdfs"   ON storage.objects;
DROP POLICY IF EXISTS "Admin/comercial can upload devis pdfs" ON storage.objects;
DROP POLICY IF EXISTS "Admin/comercial can update devis pdfs" ON storage.objects;
DROP POLICY IF EXISTS "Admin/comercial can delete devis pdfs" ON storage.objects;

CREATE POLICY "Admin/comercial can read devis pdfs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id='devis-pdfs' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'comercial')));

CREATE POLICY "Admin/comercial can upload devis pdfs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id='devis-pdfs' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'comercial')));

CREATE POLICY "Admin/comercial can update devis pdfs"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id='devis-pdfs' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'comercial')));

CREATE POLICY "Admin/comercial can delete devis pdfs"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id='devis-pdfs' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'comercial')));
