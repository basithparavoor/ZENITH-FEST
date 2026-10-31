-- =========================================================================
-- FestOS Enterprise Migration: Multiple Roles per User Support
-- Target: Supabase PostgreSQL
-- Epoch: 2026-10-31
-- Mode: Safe, Idempotent & Non-Destructive
-- =========================================================================

-- 1. Add roles JSONB column to users table if it does not already exist
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS roles JSONB DEFAULT '[]'::jsonb;

-- 2. Populate roles from existing role column for all users who do not have roles initialized
UPDATE public.users
SET roles = jsonb_build_array(role)
WHERE (roles IS NULL OR jsonb_array_length(roles) = 0) AND role IS NOT NULL;

-- 3. Comment explaining multi-role structure
COMMENT ON COLUMN public.users.roles IS 'JSON array of roles granted to this user (e.g. ["judge", "stage_controller"]). The role column holds the current active/primary role.';
