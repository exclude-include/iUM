# Supabase 스키마 설정 가이드

이 파일은 Supabase 데이터베이스 테이블 스키마를 설명합니다.

## 테이블 구조

### 1. accounts
사용자 계정 정보
```sql
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 업데이트 트리거
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 2. files
업로드된 파일 정보
```sql
CREATE TABLE files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    folder_id TEXT,
    name TEXT NOT NULL,
    content_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    storage_path TEXT NOT NULL,
    vectorized BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_files_account_id ON files(account_id);
CREATE INDEX idx_files_folder_id ON files(folder_id);

CREATE TRIGGER update_files_updated_at BEFORE UPDATE ON files
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 3. google_integrations
Google OAuth 연동 정보
```sql
CREATE TABLE google_integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_expiry TIMESTAMP WITH TIME ZONE,
    scope TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(account_id)
);

CREATE INDEX idx_google_integrations_account_id ON google_integrations(account_id);

CREATE TRIGGER update_google_integrations_updated_at BEFORE UPDATE ON google_integrations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 4. drive_files
Google Drive 파일 정보
```sql
CREATE TABLE drive_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    google_drive_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size INTEGER,
    web_view_link TEXT,
    thumbnail_link TEXT,
    folder_id TEXT,
    synced_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_drive_files_account_id ON drive_files(account_id);
CREATE INDEX idx_drive_files_folder_id ON drive_files(folder_id);
CREATE INDEX idx_drive_files_google_drive_id ON drive_files(google_drive_id);
```

### 5. history
학습 히스토리 (JSON 형식)
```sql
CREATE TABLE history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    folder_id TEXT,
    title TEXT NOT NULL,
    history_type TEXT NOT NULL CHECK (history_type IN ('timeline', 'study', 'quiz', 'document')),
    content JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_history_account_id ON history(account_id);
CREATE INDEX idx_history_folder_id ON history(folder_id);
CREATE INDEX idx_history_type ON history(history_type);
CREATE INDEX idx_history_created_at ON history(created_at DESC);

-- JSONB 컬럼에 대한 GIN 인덱스 (JSON 쿼리 성능 향상)
CREATE INDEX idx_history_content ON history USING GIN (content);
```

### 6. reels
숏폼 학습 콘텐츠
```sql
CREATE TABLE reels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    content_url TEXT NOT NULL,
    thumbnail_url TEXT,
    duration_seconds INTEGER,
    author TEXT,
    tags TEXT[],
    category TEXT,
    quiz_content JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_reels_category ON reels(category);
CREATE INDEX idx_reels_tags ON reels USING GIN (tags);
CREATE INDEX idx_reels_created_at ON reels(created_at DESC);

CREATE TRIGGER update_reels_updated_at BEFORE UPDATE ON reels
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## Row Level Security (RLS)

보안을 위해 RLS를 활성화할 수 있습니다:

```sql
-- accounts 테이블에 RLS 활성화
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 계정만 조회/수정 가능
CREATE POLICY "Users can view own account"
    ON accounts FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own account"
    ON accounts FOR UPDATE
    USING (auth.uid() = id);

-- 다른 테이블들에도 유사하게 적용
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own files"
    ON files FOR SELECT
    USING (account_id IN (SELECT id FROM accounts WHERE auth.uid() = id));

-- ... (다른 테이블들도 동일하게)
```

## 예제 쿼리

### History에서 JSON 데이터 쿼리
```sql
-- 특정 주제를 포함하는 히스토리 찾기
SELECT * FROM history
WHERE content->>'topic' = 'Linear Algebra';

-- 메시지 수가 5개 이상인 히스토리
SELECT * FROM history
WHERE jsonb_array_length(content->'messages') >= 5;

-- 특정 기간 동안의 학습 시간 합계
SELECT 
    account_id,
    SUM((content->>'duration_seconds')::INTEGER) as total_seconds
FROM history
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY account_id;
```

### Reels 태그 검색
```sql
-- 특정 태그를 포함하는 릴스 찾기
SELECT * FROM reels
WHERE 'Linear Algebra' = ANY(tags);

-- 여러 태그 중 하나라도 포함하는 릴스
SELECT * FROM reels
WHERE tags && ARRAY['Math', 'Physics', 'Calculus'];
```
