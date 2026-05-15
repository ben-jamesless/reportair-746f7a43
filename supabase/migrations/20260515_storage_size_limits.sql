-- ─────────────────────────────────────────────────────────────────────────────
-- Storage bucket size limits (L2)
--
-- Enforces a 100MB max file size on the photos bucket at the storage layer,
-- matching the client-side guard in PhotoUploader.tsx. This prevents direct
-- API uploads from bypassing the limit.
--
-- The exports bucket is capped at 50MB — PDFs are typically 1-10MB.
-- The export-assets bucket (client logos) is capped at 5MB.
--
-- Note: Supabase storage bucket settings can also be configured in the
-- Dashboard under Storage → Buckets → Edit. These SQL updates target the
-- storage.buckets table directly and take effect immediately.
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE storage.buckets
  SET file_size_limit = 104857600  -- 100MB in bytes
  WHERE id = 'photos';

UPDATE storage.buckets
  SET file_size_limit = 52428800   -- 50MB in bytes
  WHERE id = 'exports';

UPDATE storage.buckets
  SET file_size_limit = 5242880    -- 5MB in bytes
  WHERE id = 'export-assets';
