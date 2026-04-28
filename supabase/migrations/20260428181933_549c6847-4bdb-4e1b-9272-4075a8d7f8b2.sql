-- Public read access for the `logos` bucket
CREATE POLICY "Public read access to logos"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'logos');

-- Owners can upload into their own folder: ${auth.uid()}/...
CREATE POLICY "Owners can upload own logo"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'logos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Owners can update their own logo
CREATE POLICY "Owners can update own logo"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'logos'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'logos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Owners can delete their own logo
CREATE POLICY "Owners can delete own logo"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'logos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);