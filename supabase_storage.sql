-- Idempotent Supabase Storage setup.
-- This file does not delete or modify stored objects or RLS policies.
-- The backend is expected to access this private bucket using service_role.

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

COMMIT;
