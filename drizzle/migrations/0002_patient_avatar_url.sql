-- Patient profile image (INT-250)
-- Stores a fully-qualified public URL pointing into the avatars Supabase bucket.
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "avatar_url" text;
