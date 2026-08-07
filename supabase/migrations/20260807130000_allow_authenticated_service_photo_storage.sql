DROP POLICY IF EXISTS "Authenticated users can upload service photos" ON storage.objects;
CREATE POLICY "Authenticated users can upload service photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'petstore'
    AND (storage.foldername(name))[1] = 'services'
);

DROP POLICY IF EXISTS "Authenticated users can read service photos" ON storage.objects;
CREATE POLICY "Authenticated users can read service photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'petstore'
    AND (storage.foldername(name))[1] = 'services'
);
