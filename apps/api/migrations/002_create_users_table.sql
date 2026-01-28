-- Migration: Create users table for Google authentication
-- Description: Stores user profile data from Google OAuth login
-- Date: 2026-01-28

-- Table: users
-- Stores user information from Google OAuth authentication
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  google_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  picture TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Comment on table
COMMENT ON TABLE users IS 'Stores user profile data from Google OAuth authentication';

-- Trigger for automatic updated_at updates
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view and update their own profile
CREATE POLICY "Users can view their own profile"
  ON users FOR SELECT
  USING (auth.uid()::TEXT = id::TEXT);

CREATE POLICY "Users can update their own profile"
  ON users FOR UPDATE
  USING (auth.uid()::TEXT = id::TEXT);

-- Service role can manage all users (for backend API)
GRANT ALL ON users TO service_role;
GRANT SELECT ON users TO authenticated;
