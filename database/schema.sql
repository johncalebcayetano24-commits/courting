-- =============================================================================
-- A LITTLE QUESTION FOR ZEY — Supabase PostgreSQL Schema & Security Policies
-- =============================================================================
-- Run this entire script once in your Supabase Project -> SQL Editor.
--
-- Security architecture:
--   1. Anonymous visitors can ONLY insert valid responses into
--      public.courtship_responses. They CANNOT read, update, or delete rows.
--   2. Only explicitly authorized administrators listed in public.admin_users
--      (authenticated via Supabase Auth) can read submitted responses.
--   3. Even if public Auth signups were ever accidentally left enabled,
--      unauthorized signed-in accounts still CANNOT read any responses.
--   4. Submission timestamps (response_date) are enforced server-side.
-- =============================================================================

-- Ensure UUID generation support is available
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- 1. Main table: public.courtship_responses
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.courtship_responses (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    her_name                TEXT NOT NULL,
    answer                  TEXT NOT NULL,
    reason                  TEXT,
    response_date           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    selected_courtship_date DATE,
    personal_message        TEXT,

    -- Validation constraints
    CONSTRAINT chk_her_name_nonempty
        CHECK (char_length(btrim(her_name)) BETWEEN 1 AND 100),
    CONSTRAINT chk_answer_allowed
        CHECK (answer IN ('YES', 'NOT_YET', 'NO')),
    CONSTRAINT chk_reason_length
        CHECK (reason IS NULL OR char_length(reason) <= 2000),
    CONSTRAINT chk_personal_message_length
        CHECK (personal_message IS NULL OR char_length(personal_message) <= 2000),
    CONSTRAINT chk_selected_date_range
        CHECK (
            selected_courtship_date IS NULL
            OR (
                selected_courtship_date >= DATE '2000-01-01'
                AND selected_courtship_date <= DATE '2100-12-31'
            )
        ),
    CONSTRAINT chk_selected_date_only_for_yes
        CHECK (answer = 'YES' OR selected_courtship_date IS NULL)
);

COMMENT ON TABLE public.courtship_responses IS
    'Stores responses submitted from the A Little Question for Zey website.';

-- -----------------------------------------------------------------------------
-- 2. Indexes for fast admin dashboard queries
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_courtship_responses_response_date
    ON public.courtship_responses (response_date DESC);

CREATE INDEX IF NOT EXISTS idx_courtship_responses_answer
    ON public.courtship_responses (answer);

-- -----------------------------------------------------------------------------
-- 3. Server-side sanitization & timestamp integrity trigger
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sanitize_courtship_response()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    -- Strip ASCII control characters (except newline/tab) and trim whitespace
    NEW.her_name := btrim(regexp_replace(COALESCE(NEW.her_name, ''), E'[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]', '', 'g'));
    NEW.answer   := upper(btrim(COALESCE(NEW.answer, '')));

    IF NEW.reason IS NOT NULL THEN
        NEW.reason := NULLIF(
            btrim(regexp_replace(NEW.reason, E'[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]', '', 'g')),
            ''
        );
    END IF;

    IF NEW.personal_message IS NOT NULL THEN
        NEW.personal_message := NULLIF(
            btrim(regexp_replace(NEW.personal_message, E'[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]', '', 'g')),
            ''
        );
    END IF;

    -- Always record the authoritative server timestamp at submission time
    NEW.response_date := NOW();

    -- Only YES responses may carry a selected courtship date
    IF NEW.answer <> 'YES' THEN
        NEW.selected_courtship_date := NULL;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sanitize_courtship_response ON public.courtship_responses;

CREATE TRIGGER trg_sanitize_courtship_response
    BEFORE INSERT ON public.courtship_responses
    FOR EACH ROW
    EXECUTE FUNCTION public.sanitize_courtship_response();

-- -----------------------------------------------------------------------------
-- 4. Private admin allowlist table: public.admin_users
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_users (
    user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email      TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.admin_users IS
    'Explicit allowlist of Supabase Auth users permitted to view the private admin dashboard.';

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.admin_users FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.admin_users TO authenticated;

DROP POLICY IF EXISTS "Admins can verify their own admin record" ON public.admin_users;

CREATE POLICY "Admins can verify their own admin record"
    ON public.admin_users
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 5. Security-definer helper: public.is_admin()
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.admin_users
        WHERE user_id = auth.uid()
    );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- -----------------------------------------------------------------------------
-- 6. Row Level Security (RLS) for public.courtship_responses
-- -----------------------------------------------------------------------------
ALTER TABLE public.courtship_responses ENABLE ROW LEVEL SECURITY;

-- Restrict SQL privileges strictly to minimum required operations
REVOKE ALL ON TABLE public.courtship_responses FROM PUBLIC, anon, authenticated;
GRANT INSERT ON TABLE public.courtship_responses TO anon, authenticated;
GRANT SELECT ON TABLE public.courtship_responses TO authenticated;

-- Drop existing policies safely if re-running this script
DROP POLICY IF EXISTS "Allow restricted public response submission" ON public.courtship_responses;
DROP POLICY IF EXISTS "Allow verified admins to read responses" ON public.courtship_responses;

-- Restricted INSERT policy:
-- Allows anonymous visitors (and signed-in admin while testing) to submit a
-- valid response. Reading back inserted rows (.select()) is intentionally
-- blocked for anonymous users so no responses can ever be read publicly.
CREATE POLICY "Allow restricted public response submission"
    ON public.courtship_responses
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (
        her_name IS NOT NULL
        AND char_length(btrim(her_name)) BETWEEN 1 AND 100
        AND answer IN ('YES', 'NOT_YET', 'NO')
        AND (reason IS NULL OR char_length(reason) <= 2000)
        AND (personal_message IS NULL OR char_length(personal_message) <= 2000)
        AND (answer = 'YES' OR selected_courtship_date IS NULL)
    );

-- Restricted SELECT policy:
-- Only verified administrators in public.admin_users may read responses.
CREATE POLICY "Allow verified admins to read responses"
    ON public.courtship_responses
    FOR SELECT
    TO authenticated
    USING (public.is_admin());

-- =============================================================================
-- 7. REGISTER YOUR ADMIN ACCOUNT (Run AFTER creating your user in Supabase Auth)
-- =============================================================================
-- Step A: In Supabase Dashboard -> Authentication -> Users -> Add user
--         Create your private admin account with email + strong password.
--         Also disable "Allow new users to sign up" under
--         Authentication -> Sign In / Providers (User Signups).
--
-- Step B: Replace 'your-admin-email@example.com' below and run this INSERT
--         in the Supabase SQL Editor:
--
-- INSERT INTO public.admin_users (user_id, email)
-- SELECT id, email
-- FROM auth.users
-- WHERE email = 'your-admin-email@example.com'
-- ON CONFLICT (user_id) DO NOTHING;
-- =============================================================================
