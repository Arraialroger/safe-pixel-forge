-- 1. Novas colunas em vaults
ALTER TABLE public.vaults
  ADD COLUMN IF NOT EXISTS file_path text,
  ADD COLUMN IF NOT EXISTS file_name text;

-- 2. Permitir leitura pública dos cofres (necessário para /pay/:slug com chave anon)
-- O public_slug já é um identificador não enumerável.
DROP POLICY IF EXISTS "Public can read vaults" ON public.vaults;
CREATE POLICY "Public can read vaults"
ON public.vaults
FOR SELECT
TO anon, authenticated
USING (true);

-- 3. Storage policies para o bucket vault-files
-- Path convention: {owner_id}/{vault_id}/{filename}
DROP POLICY IF EXISTS "Owners can upload vault files" ON storage.objects;
CREATE POLICY "Owners can upload vault files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'vault-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Owners can read own vault files" ON storage.objects;
CREATE POLICY "Owners can read own vault files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'vault-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Owners can update own vault files" ON storage.objects;
CREATE POLICY "Owners can update own vault files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'vault-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Owners can delete own vault files" ON storage.objects;
CREATE POLICY "Owners can delete own vault files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'vault-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
);