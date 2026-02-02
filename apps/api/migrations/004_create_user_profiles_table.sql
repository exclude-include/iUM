-- Migration: Create user_profiles table for Semantic Memory (Phase 3)
-- Description: Long-term user profile storage for personalized learning
-- Date: 2026-02-02

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Table: user_profiles
-- Stores long-term user learning preferences
-- ============================================
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT UNIQUE NOT NULL,
    
    -- Learning preferences
    learning_style TEXT DEFAULT 'textual' CHECK (learning_style IN ('visual', 'textual', 'interactive')),
    expertise_level TEXT DEFAULT 'beginner' CHECK (expertise_level IN ('beginner', 'intermediate', 'advanced')),
    preferred_language TEXT DEFAULT 'ko',
    
    -- Tracked data
    interests JSONB DEFAULT '[]',           -- ["machine learning", "python", "RAG"]
    frequent_topics JSONB DEFAULT '[]',     -- [{"topic": "RAG", "count": 5}]
    
    -- Flexible preferences
    preferences JSONB DEFAULT '{}',         -- {"detail_level": "high", "examples": true}
    
    -- Statistics
    total_sessions INTEGER DEFAULT 0,
    total_messages INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);

-- Comment on table
COMMENT ON TABLE user_profiles IS 'Long-term user profiles for personalized learning experience (Phase 3)';

-- ============================================
-- Trigger: Auto-update updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_user_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER trigger_update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_user_profiles_updated_at();

-- ============================================
-- Row Level Security (RLS) Policies
-- ============================================
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own profile
CREATE POLICY "Users can view their own profile"
    ON user_profiles FOR SELECT
    USING (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can insert their own profile"
    ON user_profiles FOR INSERT
    WITH CHECK (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can update their own profile"
    ON user_profiles FOR UPDATE
    USING (auth.uid()::TEXT = user_id);

-- ============================================
-- Grant permissions
-- ============================================
GRANT SELECT, INSERT, UPDATE ON user_profiles TO authenticated;
GRANT ALL ON user_profiles TO service_role;
