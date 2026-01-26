-- Migration: Create tables for Google Drive integration and Reels
-- Description: Sets up database schema for OAuth tokens, Drive files, and video reels
-- Date: 2024-01-03

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: google_integrations
-- Stores OAuth tokens for Google Drive integration
CREATE TABLE IF NOT EXISTS google_integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expiry TIMESTAMPTZ,
  scopes TEXT[] NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast user lookups
CREATE INDEX IF NOT EXISTS idx_google_integrations_user_id ON google_integrations(user_id);

-- Comment on table
COMMENT ON TABLE google_integrations IS 'Stores Google OAuth tokens and credentials for Drive integration';

-- Table: drive_files
-- Stores metadata of synced Google Drive files
CREATE TABLE IF NOT EXISTS drive_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  google_file_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size BIGINT,
  web_view_link TEXT,
  created_time TIMESTAMPTZ,
  modified_time TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  is_processed BOOLEAN DEFAULT FALSE,
  CONSTRAINT unique_google_file_per_user UNIQUE(google_file_id, user_id)
);

-- Indexes for drive_files
CREATE INDEX IF NOT EXISTS idx_drive_files_user_id ON drive_files(user_id);
CREATE INDEX IF NOT EXISTS idx_drive_files_google_file_id ON drive_files(google_file_id);
CREATE INDEX IF NOT EXISTS idx_drive_files_is_processed ON drive_files(is_processed);

-- Comment on table
COMMENT ON TABLE drive_files IS 'Stores metadata of synced Google Drive files for RAG processing';

-- Table: reels
-- Stores video reel metadata
CREATE TABLE IF NOT EXISTS reels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  duration FLOAT,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for reels
CREATE INDEX IF NOT EXISTS idx_reels_user_id ON reels(user_id);
CREATE INDEX IF NOT EXISTS idx_reels_created_at ON reels(created_at DESC);

-- Comment on table
COMMENT ON TABLE reels IS 'Stores video reel metadata and URLs from Supabase Storage';

-- Function: Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for automatic updated_at updates
CREATE TRIGGER update_google_integrations_updated_at
  BEFORE UPDATE ON google_integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reels_updated_at
  BEFORE UPDATE ON reels
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies
-- Enable RLS on all tables
ALTER TABLE google_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE drive_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE reels ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own integrations
CREATE POLICY "Users can view their own integrations"
  ON google_integrations FOR SELECT
  USING (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can insert their own integrations"
  ON google_integrations FOR INSERT
  WITH CHECK (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can update their own integrations"
  ON google_integrations FOR UPDATE
  USING (auth.uid()::TEXT = user_id);

-- Policy: Users can only access their own drive files
CREATE POLICY "Users can view their own drive files"
  ON drive_files FOR SELECT
  USING (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can insert their own drive files"
  ON drive_files FOR INSERT
  WITH CHECK (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can update their own drive files"
  ON drive_files FOR UPDATE
  USING (auth.uid()::TEXT = user_id);

-- Policy: Users can view all reels, but only manage their own
CREATE POLICY "Anyone can view reels"
  ON reels FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own reels"
  ON reels FOR INSERT
  WITH CHECK (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can update their own reels"
  ON reels FOR UPDATE
  USING (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can delete their own reels"
  ON reels FOR DELETE
  USING (auth.uid()::TEXT = user_id);

-- Service role bypass (for API backend)
-- The service role key bypasses RLS automatically

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE ON google_integrations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON drive_files TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON reels TO authenticated;

-- Grant permissions to service role
GRANT ALL ON google_integrations TO service_role;
GRANT ALL ON drive_files TO service_role;
GRANT ALL ON reels TO service_role;
