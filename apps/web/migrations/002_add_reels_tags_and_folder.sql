-- Migration: Add tags and folder_name to reels table
-- Run this if you already have the reels table created

-- Add new columns if they don't exist
ALTER TABLE reels 
  ADD COLUMN IF NOT EXISTS folder_name TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Create indexes for better query performance (for recommendation algorithm)
CREATE INDEX IF NOT EXISTS idx_reels_tags ON reels USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_reels_folder_name ON reels(folder_name);

-- Add comment to document the purpose
COMMENT ON COLUMN reels.tags IS 'Hashtags for content categorization and recommendation algorithm';
COMMENT ON COLUMN reels.folder_name IS 'Folder/category name for organizing content and auto-tagging';
