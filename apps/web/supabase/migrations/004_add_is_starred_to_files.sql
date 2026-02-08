-- Add is_starred column to files table
ALTER TABLE public.files ADD COLUMN IF NOT EXISTS is_starred BOOLEAN DEFAULT FALSE;
