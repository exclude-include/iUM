-- Migration: Add author_name and author_avatar to reels table
-- Run this so reels show the uploader's profile (Settings profile picture) and message (description) is stored

ALTER TABLE reels
  ADD COLUMN IF NOT EXISTS author_name TEXT,
  ADD COLUMN IF NOT EXISTS author_avatar TEXT;

COMMENT ON COLUMN reels.author_name IS 'Display name of the user who uploaded the reel (from user_metadata)';
COMMENT ON COLUMN reels.author_avatar IS 'Profile picture URL of the uploader (from user_metadata.avatar_url)';
