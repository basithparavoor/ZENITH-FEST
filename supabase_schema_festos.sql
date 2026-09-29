-- =========================================================================
-- FestOS Enterprise Multi-Tenant Database Schema for Supabase
-- Copy and run this script in your Supabase Dashboard -> SQL Editor
-- =========================================================================

-- 1. Create FESTS Table (Multi-Tenancy Engine)
CREATE TABLE IF NOT EXISTS public.fests (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    domain TEXT,
    public_results_slug TEXT DEFAULT 'results',
    status TEXT DEFAULT 'active',
    venue TEXT,
    start_date DATE,
    end_date DATE,
    logo TEXT,
    theme_color TEXT DEFAULT '#6366F1',
    description TEXT,
    feature_flags JSONB DEFAULT '{
        "feature_judging": true,
        "feature_stage_display": true,
        "feature_spectator_qr": true,
        "feature_poster_generator": true,
        "feature_participant_portal": true,
        "feature_squad_roster": true,
        "feature_website_customizer": true,
        "feature_program_reports": true,
        "feature_announcements": true,
        "feature_wall_of_fame": true
    }'::jsonb,
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Drop old restrictive role check constraints on USERS dynamically and add updated constraint
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'public.users'::regclass 
        AND contype = 'c' 
        AND pg_get_constraintdef(oid) ILIKE '%role%'
    ) LOOP
        EXECUTE 'ALTER TABLE public.users DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
    END LOOP;
END $$;

ALTER TABLE public.users ADD CONSTRAINT users_role_check 
    CHECK (role IN ('super_admin', 'master_admin', 'admin', 'fest_manager', 'team_manager', 'stage_controller', 'judge', 'announcer', 'student', 'participant', 'controller'));

-- 3. Ensure fest_id & all required columns exist across ALL tables (Safe & Idempotent)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS fest_id TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_history JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS team_id UUID;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS name TEXT;

ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS fest_id TEXT;
ALTER TABLE public.stages ADD COLUMN IF NOT EXISTS fest_id TEXT;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS fest_id TEXT;
ALTER TABLE public.participants ADD COLUMN IF NOT EXISTS fest_id TEXT;
ALTER TABLE public.competitions ADD COLUMN IF NOT EXISTS fest_id TEXT;
ALTER TABLE public.judgements ADD COLUMN IF NOT EXISTS fest_id TEXT;
ALTER TABLE public.participant_competitions ADD COLUMN IF NOT EXISTS fest_id TEXT;
ALTER TABLE public.templates ADD COLUMN IF NOT EXISTS fest_id TEXT;
ALTER TABLE public.appeals ADD COLUMN IF NOT EXISTS fest_id TEXT;
ALTER TABLE public.enquiries ADD COLUMN IF NOT EXISTS fest_id TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS fest_id TEXT;

-- 4. Create CLIENT ENQUIRIES Table (Landing Page Leads)
CREATE TABLE IF NOT EXISTS public.enquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_name TEXT NOT NULL,
    organization TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    fest_date DATE,
    expected_attendees TEXT,
    message TEXT,
    status TEXT DEFAULT 'new',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create AUDIT LOGS Table (Centralized Telemetry)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    category TEXT NOT NULL,
    action TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    severity TEXT DEFAULT 'INFO',
    username TEXT,
    url TEXT,
    fest_id TEXT REFERENCES public.fests(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Insert Initial Default Festival (Zenith Fest 2026)
INSERT INTO public.fests (id, name, slug, domain, public_results_slug, status, venue, start_date, end_date, logo, theme_color)
VALUES (
    'fest_zenith_2026',
    'Zenith Fest 2026',
    'zenith26',
    'zenith26.festos.app',
    'results',
    'active',
    'Main Stadium Arena',
    '2026-10-15',
    '2026-10-18',
    'festos-logo.svg',
    '#6366F1'
)
ON CONFLICT (id) DO UPDATE 
SET name = EXCLUDED.name, slug = EXCLUDED.slug, domain = EXCLUDED.domain;

-- 7. Ensure Settings table exists for festival-specific configurations
CREATE TABLE IF NOT EXISTS public.settings (
    id TEXT PRIMARY KEY,
    value JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Backfill existing records to Zenith Fest (Preserves all historical data for Zenith Fest)
UPDATE public.categories SET fest_id = 'fest_zenith_2026' WHERE fest_id IS NULL;
UPDATE public.stages SET fest_id = 'fest_zenith_2026' WHERE fest_id IS NULL;
UPDATE public.teams SET fest_id = 'fest_zenith_2026' WHERE fest_id IS NULL;
UPDATE public.participants SET fest_id = 'fest_zenith_2026' WHERE fest_id IS NULL;
UPDATE public.competitions SET fest_id = 'fest_zenith_2026' WHERE fest_id IS NULL;
UPDATE public.judgements SET fest_id = 'fest_zenith_2026' WHERE fest_id IS NULL;
UPDATE public.participant_competitions SET fest_id = 'fest_zenith_2026' WHERE fest_id IS NULL;
UPDATE public.users SET fest_id = 'fest_zenith_2026' WHERE fest_id IS NULL AND role != 'super_admin';
UPDATE public.templates SET fest_id = 'fest_zenith_2026' WHERE fest_id IS NULL;
UPDATE public.appeals SET fest_id = 'fest_zenith_2026' WHERE fest_id IS NULL;

-- 8. Insert Default Super Admin Root Account safely
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'public.users'::regclass 
        AND contype = 'u' 
        AND pg_get_constraintdef(oid) ILIKE '%username%'
    ) THEN
        BEGIN
            ALTER TABLE public.users ADD CONSTRAINT users_username_key UNIQUE (username);
        EXCEPTION
            WHEN duplicate_table OR duplicate_object THEN NULL;
        END;
    END IF;
END $$;

INSERT INTO public.users (username, password_hash, role)
VALUES ('superadmin', 'superadmin123', 'super_admin')
ON CONFLICT (username) DO UPDATE
SET role = 'super_admin';

-- 9. Row Level Security & Access Permissions
ALTER TABLE public.fests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Full Access Fests" ON public.fests;
CREATE POLICY "Public Full Access Fests" ON public.fests FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Insert Enquiries" ON public.enquiries;
CREATE POLICY "Public Insert Enquiries" ON public.enquiries FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Full Access Audit Logs" ON public.audit_logs;
CREATE POLICY "Public Full Access Audit Logs" ON public.audit_logs FOR ALL USING (true) WITH CHECK (true);

-- 10. Enable Realtime Publications (Safely checks before adding)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'fests'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.fests;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'enquiries'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.enquiries;
    END IF;
END $$;
