-- ============================================================================
-- Fix: "infinite recursion detected in policy for relation 'users'"
-- ============================================================================
--
-- Cause: the original RLS policies query the `users` table from inside the
-- `users` policy (and from policies on other tables that read users to
-- determine the caller's org). Postgres re-evaluates the policy on every
-- access, which loops forever.
--
-- Fix: move the lookup into SECURITY DEFINER functions. Function bodies
-- run as the function owner and bypass RLS, breaking the recursion. The
-- policies then call those helpers instead of selecting from `users`.
--
-- Apply: psql "$SUPABASE_DB_URL" -f supabase/fix-rls-recursion.sql
-- (or paste into the Supabase SQL editor)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER → bypass RLS inside body)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_user_org_id()
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT org_id FROM public.users WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role IN ('admin', 'security_officer')
       FROM public.users WHERE id = auth.uid() LIMIT 1),
    FALSE
  );
$$;

-- Allow PostgREST roles to invoke the helpers
GRANT EXECUTE ON FUNCTION public.current_user_org_id()    TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_is_admin()  TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- Drop both the old (recursive) and new policy names so re-running is safe
-- ----------------------------------------------------------------------------

-- old names (from the original schema.sql)
DROP POLICY IF EXISTS "Users read own profile"               ON public.users;
DROP POLICY IF EXISTS "Users see own org audit events"       ON public.audit_events;
DROP POLICY IF EXISTS "Users see own org rules"              ON public.org_rules;
DROP POLICY IF EXISTS "Users see own org policies"           ON public.policy_profiles;
DROP POLICY IF EXISTS "Users see own org SIEM integrations"  ON public.siem_integrations;
DROP POLICY IF EXISTS "Admins can insert rules"              ON public.org_rules;

-- new names (so this migration is idempotent)
DROP POLICY IF EXISTS "Users read profiles in same org"      ON public.users;

-- ----------------------------------------------------------------------------
-- Re-create policies using the helpers (no self-reference)
-- ----------------------------------------------------------------------------

-- users: read own row, plus peers in the same org (so embedded `users(email)`
-- joins work in the audit log). No recursion because the org lookup happens
-- inside a SECURITY DEFINER function.
CREATE POLICY "Users read profiles in same org"
  ON public.users FOR SELECT
  USING (
    id = auth.uid()
    OR org_id = public.current_user_org_id()
  );

CREATE POLICY "Users see own org audit events"
  ON public.audit_events FOR SELECT
  USING (org_id = public.current_user_org_id());

CREATE POLICY "Users see own org rules"
  ON public.org_rules FOR SELECT
  USING (org_id = public.current_user_org_id());

CREATE POLICY "Users see own org policies"
  ON public.policy_profiles FOR SELECT
  USING (org_id = public.current_user_org_id());

CREATE POLICY "Users see own org SIEM integrations"
  ON public.siem_integrations FOR SELECT
  USING (org_id = public.current_user_org_id());

CREATE POLICY "Admins can insert rules"
  ON public.org_rules FOR INSERT
  WITH CHECK (
    public.current_user_is_admin()
    AND org_id = public.current_user_org_id()
  );

-- ============================================================================
-- OPTIONAL: Demo / hackathon mode
-- ============================================================================
-- The policies above require an authenticated user (auth.uid() must resolve).
-- If you're running the dashboard with the anon key and no sign-in flow yet,
-- uncomment the block below to let anon read audit_events. DO NOT ship to
-- production with this enabled.
--
-- DROP POLICY IF EXISTS "DEMO anon read audit_events" ON public.audit_events;
-- CREATE POLICY "DEMO anon read audit_events"
--   ON public.audit_events FOR SELECT
--   TO anon
--   USING (true);
--
-- DROP POLICY IF EXISTS "DEMO anon read users" ON public.users;
-- CREATE POLICY "DEMO anon read users"
--   ON public.users FOR SELECT
--   TO anon
--   USING (true);
-- ============================================================================
