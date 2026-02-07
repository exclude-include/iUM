# Supabase 대시보드 설정 가이드

> iUM 프로젝트가 정상 작동하기 위해 필요한 Supabase 설정

---

## 📋 필수 설정 체크리스트

| 항목 | 상태 체크 |
|------|----------|
| pgvector 확장 활성화 | ☐ |
| `documents` 테이블 생성 | ☐ |
| `match_documents` 함수 생성 | ☐ |
| `folders` 테이블 생성 | ☐ |
| `files` 테이블 생성 | ☐ |
| `notebooks` 테이블 생성 | ☐ |
| `reels` 테이블 생성 | ☐ |
| `match_reels_by_embedding` 함수 생성 | ☐ |
| Storage 버킷 생성 (`documents`, `reels`) | ☐ |
| 환경 변수 설정 | ☐ |

---

## 1️⃣ pgvector 확장 활성화

**Dashboard → SQL Editor**에서 실행:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

---

## 2️⃣ 핵심 테이블 생성

### 2.1 documents 테이블 (RAG 벡터 저장)

```sql
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT,
  metadata JSONB,
  embedding VECTOR(3072) -- Gemini embedding dimension
);

-- 벡터 검색 함수
CREATE OR REPLACE FUNCTION match_documents (
  query_embedding VECTOR(3072),
  match_threshold FLOAT,
  match_count INT,
  filter JSONB DEFAULT '{}'
) RETURNS TABLE (
  id UUID,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
) LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY (
    SELECT
      documents.id,
      documents.content,
      documents.metadata,
      1 - (documents.embedding <=> query_embedding) AS similarity
    FROM documents
    WHERE 1 - (documents.embedding <=> query_embedding) > match_threshold
    AND documents.metadata @> filter
    ORDER BY documents.embedding <=> query_embedding
    LIMIT match_count
  );
END;
$$;
```

### 2.2 folders 테이블

```sql
CREATE TABLE IF NOT EXISTS public.folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#3B82F6',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS 활성화
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

-- 정책
CREATE POLICY "Users can view own folders" ON public.folders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own folders" ON public.folders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own folders" ON public.folders FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own folders" ON public.folders FOR DELETE USING (auth.uid() = user_id);

-- 인덱스
CREATE INDEX IF NOT EXISTS folders_user_id_idx ON public.folders(user_id);
```

### 2.3 files 테이블

```sql
CREATE TABLE IF NOT EXISTS public.files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    folder_id TEXT,
    name TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    content_type TEXT,
    size INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS 활성화
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own files" ON public.files FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own files" ON public.files FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own files" ON public.files FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own files" ON public.files FOR DELETE USING (auth.uid() = user_id);
```

### 2.4 notebooks 테이블

```sql
CREATE TABLE IF NOT EXISTS public.notebooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    folder_id TEXT,
    title TEXT NOT NULL DEFAULT 'Untitled Notebook',
    content JSONB NOT NULL DEFAULT '{"version": "1.0", "metadata": {}, "cells": []}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS & 정책
ALTER TABLE public.notebooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notebooks" ON public.notebooks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own notebooks" ON public.notebooks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own notebooks" ON public.notebooks FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own notebooks" ON public.notebooks FOR DELETE USING (auth.uid() = user_id);

-- 인덱스
CREATE INDEX IF NOT EXISTS notebooks_user_id_idx ON public.notebooks(user_id);
CREATE INDEX IF NOT EXISTS notebooks_folder_id_idx ON public.notebooks(folder_id);
```

### 2.5 reels 테이블 (퀴즈 임베딩 포함)

```sql
CREATE TABLE IF NOT EXISTS reels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  duration FLOAT,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  tags TEXT[],
  folder_name TEXT,
  quiz JSONB,                    -- 퀴즈 데이터
  quiz_embedding VECTOR(768),    -- 퀴즈 임베딩 (추천용)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_reels_user_id ON reels(user_id);
CREATE INDEX IF NOT EXISTS idx_reels_created_at ON reels(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reels_quiz_embedding ON reels USING ivfflat (quiz_embedding vector_cosine_ops) WITH (lists = 100);

-- RLS
ALTER TABLE reels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view reels" ON reels FOR SELECT USING (true);
CREATE POLICY "Users can insert their own reels" ON reels FOR INSERT WITH CHECK (auth.uid()::TEXT = user_id);
CREATE POLICY "Users can update their own reels" ON reels FOR UPDATE USING (auth.uid()::TEXT = user_id);
CREATE POLICY "Users can delete their own reels" ON reels FOR DELETE USING (auth.uid()::TEXT = user_id);

-- 추천용 벡터 검색 함수
CREATE OR REPLACE FUNCTION match_reels_by_embedding(
  query_embedding VECTOR(768),
  match_count INT DEFAULT 1,
  similarity_threshold FLOAT DEFAULT 0.0
)
RETURNS TABLE (
  id UUID,
  user_id TEXT,
  title TEXT,
  description TEXT,
  video_url TEXT,
  thumbnail_url TEXT,
  duration FLOAT,
  views INTEGER,
  likes INTEGER,
  tags TEXT[],
  folder_name TEXT,
  quiz JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  similarity FLOAT
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id, r.user_id, r.title, r.description, r.video_url, r.thumbnail_url,
    r.duration, r.views, r.likes, r.tags, r.folder_name, r.quiz,
    r.created_at, r.updated_at,
    1 - (r.quiz_embedding <=> query_embedding) AS similarity
  FROM reels r
  WHERE r.quiz_embedding IS NOT NULL
    AND r.quiz IS NOT NULL
    AND 1 - (r.quiz_embedding <=> query_embedding) >= similarity_threshold
  ORDER BY r.quiz_embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION match_reels_by_embedding TO authenticated;
GRANT EXECUTE ON FUNCTION match_reels_by_embedding TO service_role;
```

---

## 3️⃣ Storage 버킷 생성

**Dashboard → Storage → Create bucket**

| 버킷 이름 | Public | 용도 |
|----------|--------|------|
| `documents` | No | 업로드된 PDF/텍스트 파일 |
| `reels` | Yes | 릴스 비디오 파일 |

---

## 4️⃣ 환경 변수 설정

### Backend (.env)
```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJI...  # service_role key (서버 전용)

# Google AI
GOOGLE_API_KEY=your_google_api_key
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJI...  # anon key (공개 가능)
```

---

## 5️⃣ 키 위치 확인

**Dashboard → Settings → API**

| 키 종류 | 용도 | 위치 |
|--------|------|------|
| `anon` key | 프론트엔드 | Project API keys → anon |
| `service_role` key | 백엔드 | Project API keys → service_role |
| Project URL | 둘 다 | Project URL |

> ⚠️ **주의**: `service_role` 키는 RLS를 우회하므로 절대 프론트엔드에 노출하지 마세요!

---

## 🔍 설정 확인 방법

### 테이블 존재 확인
```sql
SELECT tablename FROM pg_tables WHERE schemaname = 'public';
```

### pgvector 확장 확인
```sql
SELECT * FROM pg_extension WHERE extname = 'vector';
```

### 함수 존재 확인
```sql
SELECT proname FROM pg_proc WHERE proname LIKE 'match_%';
```
