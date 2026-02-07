-- ==========================================
-- 3. Chat History Schema (Modified for Dev)
--    Based on MEMORY_SYSTEM_PLAN.md
-- ==========================================

-- Drop existing tables if they exist (to apply changes)
DROP TABLE IF EXISTS chat_messages;
DROP TABLE IF EXISTS chat_sessions;

-- 3.1. Chat Sessions Table (Episodic Memory Container)
CREATE TABLE IF NOT EXISTS chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT, -- Changed from UUID REFERENCES auth.users(id) to TEXT for dev/mock support
    folder_id TEXT, -- Optional: Link to a specific folder context
    title TEXT,
    summary TEXT,   -- Auto-generated summary of the session
    metadata JSONB, -- Store additional context (e.g., active document)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.2. Chat Messages Table (Actual Conversation)
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    metadata JSONB, -- Store sources, tokens, etc.
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.3. Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_folder_id ON chat_sessions(folder_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);

-- 3.4. RLS Policies (Security)
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Users can only see/edit their own sessions
-- Note: For dev with mock-user-id, this might block access if auth.uid() is null.
-- However, since we use SERVICE_ROLE_KEY in backend, RLS is bypassed.
CREATE POLICY "Users can manage their own sessions"
    ON chat_sessions
    FOR ALL
    USING (auth.uid()::text = user_id);

-- Users can only see/edit messages from their own sessions
CREATE POLICY "Users can manage messages in their sessions"
    ON chat_messages
    FOR ALL
    USING (
        session_id IN (
            SELECT id FROM chat_sessions WHERE user_id = auth.uid()::text
        )
    );

-- 3.5. Updated_at Trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_chat_sessions_updated_at
    BEFORE UPDATE ON chat_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
