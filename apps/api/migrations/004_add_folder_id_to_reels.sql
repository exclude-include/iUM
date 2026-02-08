
-- Add folder_id column to reels table
ALTER TABLE reels ADD COLUMN IF NOT EXISTS folder_id UUID;
-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_reels_folder_id ON reels(folder_id);
