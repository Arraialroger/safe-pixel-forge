-- Allow public SELECT on logos bucket so upsert and public reads via storage API work
CREATE POLICY "Public can read logos"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'logos');