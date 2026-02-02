-- Migration: Create tables for chat history persistence (Phase 2)
-- Description: Enables persistent storage of chat sessions and messages in Supabase
-- Date: 2026-02-02

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Table: chat_sessions
-- Stores conversation session metadata
-- ============================================
CREATE TABLE IF NOT EXISTS chat_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    folder_id TEXT NOT NULL,
    summary TEXT,
    message_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for chat_sessions
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_folder 
    ON chat_sessions(user_id, folder_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated 
    ON chat_sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id 
    ON chat_sessions(user_id);

-- Comment on table
COMMENT ON TABLE chat_sessions IS 'Stores chat session metadata for multi-turn conversation persistence';

-- ============================================
-- Table: chat_messages
-- Stores individual chat messages
-- ============================================
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    sources JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for chat_messages
CREATE INDEX IF NOT EXISTS idx_chat_messages_session 
    ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created 
    ON chat_messages(created_at);

-- Comment on table
COMMENT ON TABLE chat_messages IS 'Stores individual chat messages within a session';

-- ============================================
-- Trigger: Auto-update updated_at on chat_sessions
-- ============================================
CREATE OR REPLACE FUNCTION update_chat_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_chat_sessions_updated_at ON chat_sessions;
CREATE TRIGGER trigger_update_chat_sessions_updated_at
    BEFORE UPDATE ON chat_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_chat_sessions_updated_at();

-- ============================================
-- Trigger: Auto-increment message_count on chat_sessions
-- ============================================
CREATE OR REPLACE FUNCTION increment_message_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE chat_sessions 
    SET message_count = message_count + 1 
    WHERE id = NEW.session_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_increment_message_count ON chat_messages;
CREATE TRIGGER trigger_increment_message_count
    AFTER INSERT ON chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION increment_message_count();

-- ============================================
-- Row Level Security (RLS) Policies
-- ============================================
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Policies for chat_sessions
CREATE POLICY "Users can view their own sessions"
    ON chat_sessions FOR SELECT
    USING (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can insert their own sessions"
    ON chat_sessions FOR INSERT
    WITH CHECK (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can update their own sessions"
    ON chat_sessions FOR UPDATE
    USING (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can delete their own sessions"
    ON chat_sessions FOR DELETE
    USING (auth.uid()::TEXT = user_id);

-- Policies for chat_messages (inherit access from session ownership)
CREATE POLICY "Users can view messages in their sessions"
    ON chat_messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM chat_sessions 
            WHERE chat_sessions.id = chat_messages.session_id 
            AND chat_sessions.user_id = auth.uid()::TEXT
        )
    );

CREATE POLICY "Users can insert messages in their sessions"
    ON chat_messages FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM chat_sessions 
            WHERE chat_sessions.id = chat_messages.session_id 
            AND chat_sessions.user_id = auth.uid()::TEXT
        )
    );

-- ============================================
-- Grant permissions
-- ============================================
GRANT SELECT, INSERT, UPDATE, DELETE ON chat_sessions TO authenticated;
GRANT SELECT, INSERT ON chat_messages TO authenticated;
GRANT ALL ON chat_sessions TO service_role;
GRANT ALL ON chat_messages TO service_role;
