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
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'upcoming', 'completed', 'archived')),
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

-- 2. Add fest_id to USERS table if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'fest_id'
    ) THEN
        ALTER TABLE public.users ADD COLUMN fest_id TEXT REFERENCES public.fests(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Ensure role column accepts 'super_admin'
DO $$
BEGIN
    -- If users table has check constraint, drop or update
    ALTER TABLE public.users ALTER COLUMN role TYPE TEXT;
END $$;

-- 3. Create CLIENT ENQUIRIES Table (Landing Page Leads)
CREATE TABLE IF NOT EXISTS public.enquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_name TEXT NOT NULL,
    organization TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    fest_date DATE,
    expected_attendees TEXT,
    message TEXT,
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'demo_scheduled', 'closed', 'archived')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create AUDIT LOGS Table (Centralized Telemetry)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    category TEXT NOT NULL,
    action TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    severity TEXT DEFAULT 'INFO' CHECK (severity IN ('INFO', 'WARNING', 'ERROR', 'CRITICAL')),
    username TEXT,
    url TEXT,
    fest_id TEXT REFERENCES public.fests(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Insert Default Initial Festival (Zenith Fest 2026)
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

-- 6. Insert Default Super Admin User
INSERT INTO public.users (username, password_hash, role)
VALUES ('superadmin', 'superadmin123', 'super_admin')
ON CONFLICT (username) DO UPDATE
SET role = 'super_admin';

-- 7. Enable Row Level Security (RLS) & Grant Public Access
ALTER TABLE public.fests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow public read and write for app operation (or configure fine-grained policies)
DROP POLICY IF EXISTS "Public Full Access Fests" ON public.fests;
CREATE POLICY "Public Full Access Fests" ON public.fests FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Insert Enquiries" ON public.enquiries;
CREATE POLICY "Public Insert Enquiries" ON public.enquiries FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Full Access Audit Logs" ON public.audit_logs;
CREATE POLICY "Public Full Access Audit Logs" ON public.audit_logs FOR ALL USING (true) WITH CHECK (true);

-- Enable Realtime for fests, enquiries, and settings
ALTER PUBLICATION supabase_realtime ADD TABLE public.fests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.enquiries;
