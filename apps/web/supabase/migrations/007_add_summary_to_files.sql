-- Migration: Add summary column to files table
-- This column stores AI-generated summaries of uploaded files for RAG context

ALTER TABLE public.files 
ADD COLUMN IF NOT EXISTS summary TEXT;

-- Add index for faster queries when fetching summaries
CREATE INDEX IF NOT EXISTS idx_files_folder_id_summary 
ON public.files(folder_id) 
WHERE summary IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN public.files.summary IS 'AI-generated summary of file content for RAG context';
