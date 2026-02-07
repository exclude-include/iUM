-- ===========================================
-- iUM Supabase 전체 설정 스크립트 (수정됨)
-- 모든 user_id가 UUID 타입으로 통일
-- ===========================================

-- 1. pgvector 확장 활성화
CREATE EXTENSION IF NOT EXISTS vector;

-- ===========================================
-- 2. documents 테이블
-- ===========================================
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT,
  metadata JSONB,
  embedding VECTOR(3072)
);

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

-- ===========================================
-- 3. folders 테이블 (user_id: UUID)
-- ===========================================
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can create own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can update own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can delete own folders" ON public.folders;

CREATE POLICY "Users can view own folders" ON public.folders FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can create own folders" ON public.folders FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own folders" ON public.folders FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own folders" ON public.folders FOR DELETE USING (user_id = auth.uid());

-- ===========================================
-- 4. files 테이블 (user_id: UUID)
-- ===========================================
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own files" ON public.files;
DROP POLICY IF EXISTS "Users can insert own files" ON public.files;
DROP POLICY IF EXISTS "Users can update own files" ON public.files;
DROP POLICY IF EXISTS "Users can delete own files" ON public.files;
DROP POLICY IF EXISTS "Service role can insert files" ON public.files;
DROP POLICY IF EXISTS "Service role can do anything" ON public.files;
DROP POLICY IF EXISTS "Allow all for files" ON public.files;

CREATE POLICY "Users can view own files" ON public.files FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "Users can insert own files" ON public.files FOR INSERT WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "Users can update own files" ON public.files FOR UPDATE USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "Users can delete own files" ON public.files FOR DELETE USING (user_id = auth.uid() OR user_id IS NULL);

-- ===========================================
-- 5. notebooks 테이블 (user_id: UUID)
-- ===========================================
ALTER TABLE public.notebooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notebooks" ON public.notebooks;
DROP POLICY IF EXISTS "Users can insert own notebooks" ON public.notebooks;
DROP POLICY IF EXISTS "Users can update own notebooks" ON public.notebooks;
DROP POLICY IF EXISTS "Users can delete own notebooks" ON public.notebooks;

CREATE POLICY "Users can view own notebooks" ON public.notebooks FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own notebooks" ON public.notebooks FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own notebooks" ON public.notebooks FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own notebooks" ON public.notebooks FOR DELETE USING (user_id = auth.uid());

-- ===========================================
-- 6. reels 테이블 (user_id: UUID) ✅ 수정됨!
-- ===========================================
ALTER TABLE reels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view reels" ON reels;
DROP POLICY IF EXISTS "Users can insert their own reels" ON reels;
DROP POLICY IF EXISTS "Users can update their own reels" ON reels;
DROP POLICY IF EXISTS "Users can delete their own reels" ON reels;

-- ✅ UUID = UUID 비교 (캐스팅 없음)
CREATE POLICY "Anyone can view reels" ON reels FOR SELECT USING (true);
CREATE POLICY "Users can insert their own reels" ON reels FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update their own reels" ON reels FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete their own reels" ON reels FOR DELETE USING (user_id = auth.uid());

-- ===========================================
-- 7. match_reels_by_embedding 함수 (UUID 반영)
-- ===========================================
-- ⚠️ 반환 타입 변경을 위해 먼저 DROP
DROP FUNCTION IF EXISTS match_reels_by_embedding(vector, integer, double precision);

CREATE OR REPLACE FUNCTION match_reels_by_embedding(
  query_embedding VECTOR(768),
  match_count INT DEFAULT 1,
  similarity_threshold FLOAT DEFAULT 0.0
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
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

-- ===========================================
-- 8. 권한 부여
-- ===========================================
GRANT EXECUTE ON FUNCTION match_documents TO authenticated;
GRANT EXECUTE ON FUNCTION match_documents TO service_role;
GRANT EXECUTE ON FUNCTION match_reels_by_embedding TO authenticated;
GRANT EXECUTE ON FUNCTION match_reels_by_embedding TO service_role;
