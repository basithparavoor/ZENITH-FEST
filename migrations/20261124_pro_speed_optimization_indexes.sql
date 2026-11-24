-- =========================================================================
-- FestOS Enterprise: High-Performance Database Speed Optimization
-- Target Platform: Supabase PostgreSQL (Pro Plan)
-- Mode: Safe, Idempotent (IF NOT EXISTS), Zero-Downtime
-- =========================================================================
-- How to apply:
-- 1. Open your Supabase Dashboard: https://supabase.com/dashboard
-- 2. Go to "SQL Editor" on the left sidebar
-- 3. Click "New Query", paste this entire script, and click "Run"
-- =========================================================================

-- 1. JUDGEMENTS TABLE (Instant Results & Scoring Lookups)
-- Accelerates leaderboard generation, score calculations, and live result lookups
CREATE INDEX IF NOT EXISTS idx_judgements_fest_id 
    ON public.judgements(fest_id);

CREATE INDEX IF NOT EXISTS idx_judgements_comp_id 
    ON public.judgements(competition_id);

CREATE INDEX IF NOT EXISTS idx_judgements_part_id 
    ON public.judgements(participant_id);

CREATE INDEX IF NOT EXISTS idx_judgements_comp_part 
    ON public.judgements(competition_id, participant_id);

-- Partial index for active scored judgements (dramatically speeds up results.html)
CREATE INDEX IF NOT EXISTS idx_judgements_scored_active 
    ON public.judgements(competition_id) 
    WHERE awarded_mark IS NOT NULL AND participant_id IS NOT NULL;


-- 2. PARTICIPANT COMPETITIONS TABLE (Registration & Attendance Scans)
-- Accelerates stage controller, judge evaluation sync, and certificate verification
CREATE INDEX IF NOT EXISTS idx_part_comps_fest_id 
    ON public.participant_competitions(fest_id);

CREATE INDEX IF NOT EXISTS idx_part_comps_comp_id 
    ON public.participant_competitions(competition_id);

CREATE INDEX IF NOT EXISTS idx_part_comps_part_id 
    ON public.participant_competitions(participant_id);

CREATE INDEX IF NOT EXISTS idx_part_comps_comp_part 
    ON public.participant_competitions(competition_id, participant_id);

-- Partial index for checked-in participants used in judge.js & stage-controller.js
CREATE INDEX IF NOT EXISTS idx_part_comps_checked_in 
    ON public.participant_competitions(competition_id, is_present) 
    WHERE is_present = true;


-- 3. COMPETITIONS TABLE (Catalog & Publishing Scans)
-- Accelerates timeline dropdown, published results tab, and schedule filters
CREATE INDEX IF NOT EXISTS idx_competitions_fest_status 
    ON public.competitions(fest_id, status);

CREATE INDEX IF NOT EXISTS idx_competitions_status 
    ON public.competitions(status);


-- 4. PARTICIPANTS TABLE (Participant Portal, Roster & Team Views)
-- Accelerates team management rosters, chest number lookups, and badge generation
CREATE INDEX IF NOT EXISTS idx_participants_fest_team 
    ON public.participants(fest_id, team_id);

CREATE INDEX IF NOT EXISTS idx_participants_team_id 
    ON public.participants(team_id);

CREATE INDEX IF NOT EXISTS idx_participants_unique_id 
    ON public.participants(unique_id);


-- 5. USERS & AUTHENTICATION TABLE (Instant Login & Session Verification)
-- Accelerates multi-role verification, team login, and superadmin telemetry
CREATE INDEX IF NOT EXISTS idx_users_fest_id 
    ON public.users(fest_id);

CREATE INDEX IF NOT EXISTS idx_users_role 
    ON public.users(role);


-- 6. TEAMS, STAGES & CATEGORIES (Metadata Lookups)
CREATE INDEX IF NOT EXISTS idx_teams_fest_id 
    ON public.teams(fest_id);

CREATE INDEX IF NOT EXISTS idx_stages_fest_id 
    ON public.stages(fest_id);

CREATE INDEX IF NOT EXISTS idx_categories_fest_id 
    ON public.categories(fest_id);


-- 7. TEMPLATES & CERTIFICATES
-- Accelerates instant poster rendering and template switcher
CREATE INDEX IF NOT EXISTS idx_templates_fest_type 
    ON public.templates(fest_id, type);


-- 8. APPEALS & BROADCASTS
CREATE INDEX IF NOT EXISTS idx_appeals_fest_id 
    ON public.appeals(fest_id);

CREATE INDEX IF NOT EXISTS idx_appeals_comp_id 
    ON public.appeals(competition_id);

CREATE INDEX IF NOT EXISTS idx_broadcasts_target_active 
    ON public.broadcasts(target_fest_id, is_active);


-- 9. RE-ANALYZE DATABASE STATISTICS
-- Tells PostgreSQL's query optimizer to immediately use the new indexes
ANALYZE public.judgements;
ANALYZE public.participant_competitions;
ANALYZE public.competitions;
ANALYZE public.participants;
ANALYZE public.teams;
ANALYZE public.stages;
ANALYZE public.categories;
ANALYZE public.users;
ANALYZE public.templates;
ANALYZE public.appeals;
ANALYZE public.broadcasts;
ANALYZE public.settings;

-- Output confirmation notice
SELECT 'FestOS High-Performance Speed Indexes successfully deployed!' AS result;
