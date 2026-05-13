
INSERT INTO storage.buckets (id, name, public)
VALUES ('devis-pdfs', 'devis-pdfs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated can upload devis pdfs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'devis-pdfs');

CREATE POLICY "Authenticated can read devis pdfs"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'devis-pdfs');
