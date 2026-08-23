-- Idempotent Supabase Storage setup.
-- This file does not delete or modify stored objects.

BEGIN;

INSERT INTO storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
)
VALUES (
    'petstore',
    'petstore',
    FALSE,
    NULL,
    NULL
)
ON CONFLICT (id) DO UPDATE
SET
    name = EXCLUDED.name,
    public = FALSE,
    file_size_limit = NULL,
    allowed_mime_types = NULL;

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

COMMIT;
