-- Migration: Create activities table for learning activity tracking
-- Description: Stores user learning activities for stats and streak tracking
-- Date: 2026-02-09

-- Table: activities
-- Stores all learning activity events (cell creation, quiz submission, chat, etc.)
CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,  -- cell_created, quiz_submitted, chat_message, document_uploaded, session_start, session_end
  metadata JSONB DEFAULT '{}',  -- { cell_type, quiz_score, duration_seconds, topic, folder_id }
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_activities_user_id ON activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_created_at ON activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_event_type ON activities(event_type);
CREATE INDEX IF NOT EXISTS idx_activities_user_date ON activities(user_id, created_at);

-- Comment on table
COMMENT ON TABLE activities IS 'Stores learning activity events for analytics and streak tracking';

-- Row Level Security (RLS) Policies
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own activities
CREATE POLICY "Users can view their own activities"
  ON activities FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own activities"
  ON activities FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Service role can do everything (for API backend)
CREATE POLICY "Service role has full access to activities"
  ON activities FOR ALL
  USING (auth.role() = 'service_role');

-- Grant permissions
GRANT SELECT, INSERT ON activities TO authenticated;
GRANT ALL ON activities TO service_role;
