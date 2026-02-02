-- =============================================================================
-- Migration: Create notebooks table for auto-save functionality
-- =============================================================================

-- 1. Create the notebooks table
CREATE TABLE IF NOT EXISTS public.notebooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    folder_id TEXT, -- Optional: link to knowledge folders
    title TEXT NOT NULL DEFAULT 'Untitled Notebook',
    content JSONB NOT NULL DEFAULT '{"version": "1.0", "metadata": {}, "cells": []}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create index for faster queries
CREATE INDEX IF NOT EXISTS notebooks_user_id_idx ON public.notebooks(user_id);
CREATE INDEX IF NOT EXISTS notebooks_folder_id_idx ON public.notebooks(folder_id);
CREATE INDEX IF NOT EXISTS notebooks_updated_at_idx ON public.notebooks(updated_at DESC);

-- 3. Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Apply trigger to notebooks table
DROP TRIGGER IF EXISTS set_notebooks_updated_at ON public.notebooks;
CREATE TRIGGER set_notebooks_updated_at
    BEFORE UPDATE ON public.notebooks
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- =============================================================================
-- Row Level Security (RLS) Policies
-- =============================================================================

-- 5. Enable RLS
ALTER TABLE public.notebooks ENABLE ROW LEVEL SECURITY;

-- 6. Policy: Users can view their own notebooks
CREATE POLICY "Users can view own notebooks"
    ON public.notebooks
    FOR SELECT
    USING (auth.uid() = user_id);

-- 7. Policy: Users can insert their own notebooks
CREATE POLICY "Users can insert own notebooks"
    ON public.notebooks
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- 8. Policy: Users can update their own notebooks
CREATE POLICY "Users can update own notebooks"
    ON public.notebooks
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 9. Policy: Users can delete their own notebooks
CREATE POLICY "Users can delete own notebooks"
    ON public.notebooks
    FOR DELETE
    USING (auth.uid() = user_id);

-- =============================================================================
-- Optional: Create a view for notebook list (metadata only, no content)
-- =============================================================================

CREATE OR REPLACE VIEW public.notebooks_list AS
SELECT
    id,
    user_id,
    folder_id,
    title,
    content->'metadata' as metadata,
    jsonb_array_length(content->'cells') as cell_count,
    created_at,
    updated_at
FROM public.notebooks;

-- Grant access to the view
GRANT SELECT ON public.notebooks_list TO authenticated;
