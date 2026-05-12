-- ============================================================================
-- Seed demo data for the dashboard
-- ============================================================================
-- Inserts a demo org and ~12 sample audit events spanning every mode,
-- severity, category, and AI tool the UI knows about. Also enables a
-- DEMO anon-read policy so the dashboard can render rows without a
-- sign-in flow.
--
-- Apply: psql "$SUPABASE_DB_URL" -f supabase/seed-demo-data.sql
-- (or paste into the Supabase SQL editor)
--
-- Re-run safely: the script wipes and reseeds the demo org's events.
-- DO NOT ship the anon-read policy to production — remove it before going live.
-- ============================================================================

DO $$
DECLARE
  demo_org UUID;
BEGIN
  -- 1. Demo org (idempotent on domain)
  INSERT INTO public.organisations (name, domain)
  VALUES ('PromptShield Demo', 'demo.promptshield.io')
  ON CONFLICT (domain) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO demo_org;

  -- 2. Wipe previous demo events (idempotent reseed)
  DELETE FROM public.audit_events WHERE org_id = demo_org;

  -- 3. Seed events covering every mode / severity / category / tool
  INSERT INTO public.audit_events
    (org_id, session_id, event_type, mode, detection_count,
     categories_found, max_severity, ai_tool, action_taken, timestamp)
  VALUES
    (demo_org, 'sess_a1', 'masked',    'fix',    3,
     ARRAY['PHI','PII'],          'high',     'chatgpt',  'masked',
     now() - interval '4 minutes'),

    (demo_org, 'sess_a1', 'detection', 'fix',    1,
     ARRAY['PII'],                'medium',   'chatgpt',  'masked',
     now() - interval '11 minutes'),

    (demo_org, 'sess_b2', 'blocked',   'warn',   5,
     ARRAY['SECRET'],             'critical', 'claude',   'blocked',
     now() - interval '38 minutes'),

    (demo_org, 'sess_b2', 'masked',    'warn',   2,
     ARRAY['PHI'],                'critical', 'claude',   'masked',
     now() - interval '52 minutes'),

    (demo_org, 'sess_c3', 'allowed',   'shadow', 1,
     ARRAY['FINANCIAL'],          'high',     'gemini',   'allowed',
     now() - interval '2 hours'),

    (demo_org, 'sess_c3', 'detection', 'shadow', 4,
     ARRAY['PHI','PII','FINANCIAL'], 'high',  'gemini',   'detected',
     now() - interval '3 hours'),

    (demo_org, 'sess_d4', 'masked',    'fix',    7,
     ARRAY['PHI','PII','SECRET'], 'critical', 'copilot',  'masked',
     now() - interval '5 hours'),

    (demo_org, 'sess_d4', 'masked',    'fix',    2,
     ARRAY['PII'],                'medium',   'copilot',  'masked',
     now() - interval '8 hours'),

    (demo_org, 'sess_e5', 'blocked',   'warn',   1,
     ARRAY['SECRET'],             'critical', 'chatgpt',  'blocked',
     now() - interval '1 day'),

    (demo_org, 'sess_e5', 'allowed',   'warn',   3,
     ARRAY['PHI','PII'],          'high',     'chatgpt',  'allowed',
     now() - interval '1 day 3 hours'),

    (demo_org, 'sess_f6', 'detection', 'shadow', 2,
     ARRAY['CUSTOM'],             'low',      'claude',   'detected',
     now() - interval '2 days'),

    (demo_org, 'sess_f6', 'masked',    'fix',    6,
     ARRAY['PHI','FINANCIAL'],    'high',     'claude',   'masked',
     now() - interval '3 days');
END $$;

-- ============================================================================
-- DEMO anon-read policies (DEV ONLY — remove before production)
-- ============================================================================
-- The policies created by fix-rls-recursion.sql require an authenticated
-- user. With just the anon key, every query returns []. These policies
-- let anon read demo data so the dashboard renders.

DROP POLICY IF EXISTS "DEMO anon read audit_events" ON public.audit_events;
CREATE POLICY "DEMO anon read audit_events"
  ON public.audit_events FOR SELECT
  TO anon
  USING (true);

-- Lets the Shield Demo page write events from the browser (anon key).
-- DO NOT ship to production — gate inserts on auth.uid() / org membership
-- before going live.
DROP POLICY IF EXISTS "DEMO anon insert audit_events" ON public.audit_events;
CREATE POLICY "DEMO anon insert audit_events"
  ON public.audit_events FOR INSERT
  TO anon
  WITH CHECK (true);

-- The dashboard looks up the demo org by domain to stamp org_id on
-- inserted events. Allow anon to read the organisations table for that
-- lookup (DEMO ONLY).
DROP POLICY IF EXISTS "DEMO anon read organisations" ON public.organisations;
CREATE POLICY "DEMO anon read organisations"
  ON public.organisations FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "DEMO anon read org_rules" ON public.org_rules;
CREATE POLICY "DEMO anon read org_rules"
  ON public.org_rules FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "DEMO anon read policy_profiles" ON public.policy_profiles;
CREATE POLICY "DEMO anon read policy_profiles"
  ON public.policy_profiles FOR SELECT
  TO anon
  USING (true);

-- Quick sanity check — should print 12 after running
SELECT COUNT(*) AS demo_events_inserted
FROM public.audit_events
WHERE session_id LIKE 'sess_%';
