-- 1. Enable pgvector extension
create extension if not exists vector;

-- 2. Create documents table
-- ✨ Modified: Use UUID for ID to match LangChain defaults (Fixes 22P02 error)
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  content text,
  metadata jsonb,
  embedding vector(3072) -- Gemini defaults to 768, but we found 3072 in tests.
);

-- 3. Create match_documents function for similarity search
create or replace function match_documents (
  query_embedding vector(3072),
  match_threshold float,
  match_count int,
  filter jsonb default '{}'
) returns table (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
) language plpgsql stable as $$
begin
  return query(
    select
      documents.id,
      documents.content,
      documents.metadata,
      1 - (documents.embedding <=> query_embedding) as similarity
    from documents
    where 1 - (documents.embedding <=> query_embedding) > match_threshold
    and documents.metadata @> filter
    order by documents.embedding <=> query_embedding
    limit match_count
  );
end;
$$;
