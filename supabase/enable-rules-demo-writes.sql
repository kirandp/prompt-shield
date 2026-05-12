-- ============================================================================
-- Enable the Custom Rules page to read/write org_rules with the anon key
-- ============================================================================
-- The shipped schema only allows authenticated admins to INSERT into
-- org_rules, and there are no UPDATE/DELETE policies at all -- so the
-- dashboard's Custom Rules page (running with the anon key in demo mode)
-- silently fails on every create/edit/delete.
--
-- Apply: psql "$SUPABASE_DB_URL" -f supabase/enable-rules-demo-writes.sql
-- (or paste into the Supabase SQL editor)
--
-- DEMO ONLY -- gate on auth.uid() / org membership before going live.
-- ============================================================================

DROP POLICY IF EXISTS "DEMO anon read org_rules" ON public.org_rules;
CREATE POLICY "DEMO anon read org_rules"
  ON public.org_rules FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "DEMO anon insert org_rules" ON public.org_rules;
CREATE POLICY "DEMO anon insert org_rules"
  ON public.org_rules FOR INSERT
  TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "DEMO anon update org_rules" ON public.org_rules;
CREATE POLICY "DEMO anon update org_rules"
  ON public.org_rules FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "DEMO anon delete org_rules" ON public.org_rules;
CREATE POLICY "DEMO anon delete org_rules"
  ON public.org_rules FOR DELETE
  TO anon
  USING (true);
