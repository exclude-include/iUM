-- Migration: Add quiz and embedding support to reels table
-- Description: Adds JSONB quiz column and pgvector embedding for Soft Mode recommendation
-- Date: 2024-01-29

-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Add quiz column (JSONB) to store quiz data
-- Structure: { "question": "...", "options": [{"key": "A", "text": "..."}], "answer": "A", "explanation": "..." }
ALTER TABLE reels
  ADD COLUMN IF NOT EXISTS quiz JSONB;

-- Add quiz_embedding column for vector similarity search
-- Using 768 dimensions for text-embedding-004 model
ALTER TABLE reels
  ADD COLUMN IF NOT EXISTS quiz_embedding vector(768);

-- Create index for vector similarity search using IVFFlat
-- Note: Run this after you have some data, or use HNSW for small datasets
CREATE INDEX IF NOT EXISTS idx_reels_quiz_embedding
  ON reels USING ivfflat (quiz_embedding vector_cosine_ops)
  WITH (lists = 100);

-- Alternative: HNSW index (better for smaller datasets, no training needed)
-- CREATE INDEX IF NOT EXISTS idx_reels_quiz_embedding_hnsw
--   ON reels USING hnsw (quiz_embedding vector_cosine_ops);

-- Comment on new columns
COMMENT ON COLUMN reels.quiz IS 'Quiz data in JSONB format: {question, options[], answer, explanation}';
COMMENT ON COLUMN reels.quiz_embedding IS 'Embedding vector of quiz text (question + options) for similarity search';

-- Function: Match reels by embedding similarity
-- Used for Soft Mode recommendation system
CREATE OR REPLACE FUNCTION match_reels_by_embedding(
  query_embedding vector(768),
  match_count int DEFAULT 1,
  similarity_threshold float DEFAULT 0.0
)
RETURNS TABLE (
  id uuid,
  user_id text,
  title text,
  description text,
  video_url text,
  thumbnail_url text,
  duration float,
  views integer,
  likes integer,
  tags text[],
  folder_name text,
  quiz jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.user_id,
    r.title,
    r.description,
    r.video_url,
    r.thumbnail_url,
    r.duration,
    r.views,
    r.likes,
    r.tags,
    r.folder_name,
    r.quiz,
    r.created_at,
    r.updated_at,
    1 - (r.quiz_embedding <=> query_embedding) AS similarity
  FROM reels r
  WHERE r.quiz_embedding IS NOT NULL
    AND r.quiz IS NOT NULL
    AND 1 - (r.quiz_embedding <=> query_embedding) >= similarity_threshold
  ORDER BY r.quiz_embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION match_reels_by_embedding TO authenticated;
GRANT EXECUTE ON FUNCTION match_reels_by_embedding TO service_role;
