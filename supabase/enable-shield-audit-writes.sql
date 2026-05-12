-- ============================================================================
-- Enable the Shield Demo page to persist audit events
-- ============================================================================
-- The schema only ships SELECT policies on audit_events, so anon-key inserts
-- from the Shield page were being silently rejected by RLS. Apply this once
-- if you've already run seed-demo-data.sql.
--
-- Apply: psql "$SUPABASE_DB_URL" -f supabase/enable-shield-audit-writes.sql
-- (or paste into the Supabase SQL editor)
--
-- DEMO ONLY — gate on auth.uid() / org membership before going live.
-- ============================================================================

DROP POLICY IF EXISTS "DEMO anon insert audit_events" ON public.audit_events;
CREATE POLICY "DEMO anon insert audit_events"
  ON public.audit_events FOR INSERT
  TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "DEMO anon read organisations" ON public.organisations;
CREATE POLICY "DEMO anon read organisations"
  ON public.organisations FOR SELECT
  TO anon
  USING (true);
