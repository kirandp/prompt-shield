-- PromptShield Supabase Schema
-- Complete database setup for audit trail, rules, and policies

-- ============================================================================
-- Organizations
-- ============================================================================

CREATE TABLE IF NOT EXISTS organisations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  domain TEXT UNIQUE,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- Users
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  org_id UUID REFERENCES organisations(id),
  email TEXT,
  full_name TEXT,
  role TEXT DEFAULT 'user', -- 'user', 'admin', 'security_officer'
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- Audit Events (Append-only, never UPDATE or DELETE)
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id UUID REFERENCES organisations(id),
  user_id UUID REFERENCES users(id),
  session_id TEXT,
  event_type TEXT NOT NULL, -- 'detection', 'masked', 'blocked', 'allowed', 'alert', etc.
  mode TEXT, -- 'shadow', 'fix', 'warn'
  detection_count INT DEFAULT 0,
  categories_found TEXT[] DEFAULT ARRAY[]::TEXT[], -- ['PHI', 'PII', 'SECRET']
  max_severity TEXT, -- 'critical', 'high', 'medium', 'low'
  ai_tool TEXT, -- 'chatgpt', 'claude', 'gemini', 'copilot', etc.
  action_taken TEXT, -- 'detected', 'masked', 'blocked', 'allowed', 'warned'
  context_metadata JSONB, -- Additional non-sensitive context
  timestamp TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT audit_events_immutable CHECK (true)
);

CREATE INDEX idx_audit_events_org_id ON audit_events(org_id);
CREATE INDEX idx_audit_events_user_id ON audit_events(user_id);
CREATE INDEX idx_audit_events_timestamp ON audit_events(timestamp DESC);
CREATE INDEX idx_audit_events_event_type ON audit_events(event_type);
CREATE INDEX idx_audit_events_mode ON audit_events(mode);

-- ============================================================================
-- Custom Rules (Organization-level)
-- ============================================================================

CREATE TABLE IF NOT EXISTS org_rules (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id UUID REFERENCES organisations(id) NOT NULL,
  created_by UUID REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT,
  rule_type TEXT NOT NULL, -- 'exact', 'regex', 'category', 'keyword'
  match_pattern TEXT, -- For exact/regex/keyword
  replacement TEXT NOT NULL,
  category TEXT, -- For category-type rules
  case_sensitive BOOLEAN DEFAULT false,
  scope TEXT DEFAULT 'session', -- 'session', 'always'
  enabled BOOLEAN DEFAULT true,
  hit_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT rule_type_valid CHECK (rule_type IN ('exact', 'regex', 'category', 'keyword'))
);

CREATE INDEX idx_org_rules_org_id ON org_rules(org_id);
CREATE INDEX idx_org_rules_enabled ON org_rules(enabled);
CREATE INDEX idx_org_rules_created_at ON org_rules(created_at DESC);

-- ============================================================================
-- Policy Profiles
-- ============================================================================

CREATE TABLE IF NOT EXISTS policy_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organisations(id) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  
  -- Detection settings
  detect_phi BOOLEAN DEFAULT true,
  detect_pii BOOLEAN DEFAULT true,
  detect_secrets BOOLEAN DEFAULT true,
  detect_financial BOOLEAN DEFAULT true,
  
  -- Mode and behavior
  default_mode TEXT DEFAULT 'warn', -- 'shadow', 'fix', 'warn'
  require_user_confirmation BOOLEAN DEFAULT false,
  allow_auto_masking BOOLEAN DEFAULT true,
  
  -- Scope
  ai_tool_scope TEXT[] DEFAULT ARRAY['chatgpt', 'claude', 'gemini', 'copilot']::TEXT[],
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_policy_profiles_org_id ON policy_profiles(org_id);
CREATE INDEX idx_policy_profiles_is_default ON policy_profiles(is_default);

-- ============================================================================
-- User Policy Assignments
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_policy_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  policy_id UUID REFERENCES policy_profiles(id) NOT NULL,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  assigned_by UUID REFERENCES users(id),
  expires_at TIMESTAMPTZ,
  
  UNIQUE(user_id, policy_id)
);

CREATE INDEX idx_user_policy_assignments_user_id ON user_policy_assignments(user_id);
CREATE INDEX idx_user_policy_assignments_policy_id ON user_policy_assignments(policy_id);

-- ============================================================================
-- Alert Preferences
-- ============================================================================

CREATE TABLE IF NOT EXISTS alert_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organisations(id) NOT NULL,
  user_id UUID REFERENCES users(id),
  
  -- Alert triggers
  alert_on_critical BOOLEAN DEFAULT true,
  alert_on_multiple_detections BOOLEAN DEFAULT true,
  alert_threshold INT DEFAULT 5, -- Alert if more than N detections
  
  -- Notification channels
  slack_webhook_url TEXT,
  email_enabled BOOLEAN DEFAULT true,
  
  -- Digest preferences
  daily_digest BOOLEAN DEFAULT true,
  weekly_digest BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_alert_preferences_org_id ON alert_preferences(org_id);
CREATE INDEX idx_alert_preferences_user_id ON alert_preferences(user_id);

-- ============================================================================
-- SIEM Integration
-- ============================================================================

CREATE TABLE IF NOT EXISTS siem_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organisations(id) NOT NULL,
  name TEXT NOT NULL,
  siem_type TEXT NOT NULL, -- 'splunk', 'datadog', 'sentinel', 'elastic'
  api_endpoint TEXT,
  api_key_encrypted TEXT, -- Store encrypted
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_siem_integrations_org_id ON siem_integrations(org_id);

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_policy_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE siem_integrations ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS Policies
-- ============================================================================

-- Users can only see their own organization's data
CREATE POLICY "Users see own org audit events"
  ON audit_events FOR SELECT
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users see own org rules"
  ON org_rules FOR SELECT
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users see own org policies"
  ON policy_profiles FOR SELECT
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users see own org SIEM integrations"
  ON siem_integrations FOR SELECT
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

-- Admins can insert rules
CREATE POLICY "Admins can insert rules"
  ON org_rules FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('admin', 'security_officer')
      AND org_id = org_rules.org_id
    )
  );

-- Users can read their own profile
CREATE POLICY "Users read own profile"
  ON users FOR SELECT
  USING (id = auth.uid() OR 
         EXISTS (
           SELECT 1 FROM users admin_check
           WHERE admin_check.id = auth.uid()
           AND admin_check.role IN ('admin', 'security_officer')
           AND admin_check.org_id = users.org_id
         ));

-- ============================================================================
-- Realtime Subscriptions
-- ============================================================================

-- Enable Realtime for real-time policy sync and audit updates
ALTER PUBLICATION supabase_realtime ADD TABLE org_rules;
ALTER PUBLICATION supabase_realtime ADD TABLE policy_profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE audit_events;

-- ============================================================================
-- Functions
-- ============================================================================

-- Function to get organization by user ID
CREATE OR REPLACE FUNCTION get_user_org_id(user_uuid UUID)
RETURNS UUID AS $$
  SELECT org_id FROM users WHERE id = user_uuid LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER;

-- Function to increment rule hit count
CREATE OR REPLACE FUNCTION increment_rule_hits(rule_id BIGINT)
RETURNS void AS $$
  UPDATE org_rules SET hit_count = hit_count + 1 WHERE id = rule_id;
$$ LANGUAGE SQL SECURITY DEFINER;

-- Function to export audit events to CSV format
CREATE OR REPLACE FUNCTION export_audit_events_csv(org_uuid UUID, start_date TIMESTAMPTZ, end_date TIMESTAMPTZ)
RETURNS TABLE(csv_data TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT string_agg(
    CONCAT(
      timestamp, '|',
      event_type, '|',
      mode, '|',
      detection_count, '|',
      array_to_string(categories_found, ';'), '|',
      max_severity, '|',
      action_taken, '|',
      ai_tool, '|',
      user_id
    ),
    E'\n'
  )
  FROM audit_events
  WHERE org_id = org_uuid
  AND timestamp >= start_date
  AND timestamp <= end_date
  ORDER BY timestamp DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Seed Data (Optional - for testing)
-- ============================================================================

-- Create a default organization
INSERT INTO organisations (name, domain) 
VALUES ('Acme Corp', 'acme.com')
ON CONFLICT DO NOTHING;

-- Get the org ID for seeding
-- Note: In production, you'd use the actual org ID after creation
