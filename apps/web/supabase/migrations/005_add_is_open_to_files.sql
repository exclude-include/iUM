-- Add is_open column to files table for tracking open tab state
ALTER TABLE public.files ADD COLUMN IF NOT EXISTS is_open BOOLEAN DEFAULT FALSE;
